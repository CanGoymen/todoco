#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
#![allow(unexpected_cfgs)]

#[cfg(desktop)]
use tauri::{Manager, WindowEvent};

#[cfg(desktop)]
use tauri::{
    Emitter, PhysicalPosition, Position, WebviewWindow,
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
};

#[cfg(desktop)]
use tauri_plugin_autostart::{MacosLauncher, ManagerExt};

#[tauri::command]
#[allow(non_camel_case_types)]
fn get_system_idle_time() -> Result<u64, String> {
    #[cfg(target_os = "macos")]
    {
        use core_foundation::base::TCFType;
        use core_foundation::dictionary::CFDictionary;
        use core_foundation::number::CFNumber;
        use core_foundation::string::CFString;
        use std::os::raw::{c_char, c_int, c_uint, c_void};
        use std::ptr;

        type mach_port_t = c_uint;
        type io_object_t = mach_port_t;
        type io_service_t = io_object_t;
        type kern_return_t = c_int;

        #[repr(C)]
        struct __CFDictionary(c_void);
        type CFDictionaryRef = *const __CFDictionary;
        type CFMutableDictionaryRef = *mut __CFDictionary;
        type CFAllocatorRef = *const c_void;

        const K_CF_ALLOCATOR_DEFAULT: CFAllocatorRef = ptr::null();
        const K_IO_MASTER_PORT_DEFAULT: mach_port_t = 0;

        #[link(name = "IOKit", kind = "framework")]
        extern "C" {
            fn IOServiceGetMatchingService(
                mainPort: mach_port_t,
                matching: CFMutableDictionaryRef,
            ) -> io_service_t;
            fn IOServiceMatching(name: *const c_char) -> CFMutableDictionaryRef;
            fn IORegistryEntryCreateCFProperties(
                entry: io_service_t,
                properties: *mut CFDictionaryRef,
                allocator: CFAllocatorRef,
                options: c_uint,
            ) -> kern_return_t;
            fn IOObjectRelease(object: io_object_t) -> kern_return_t;
        }

        unsafe {
            let service = IOServiceGetMatchingService(
                K_IO_MASTER_PORT_DEFAULT,
                IOServiceMatching(b"IOHIDSystem\0".as_ptr() as *const c_char),
            );

            if service == 0 {
                return Err("Failed to get IOHIDSystem service".to_string());
            }

            let mut properties: CFDictionaryRef = ptr::null();
            let result = IORegistryEntryCreateCFProperties(
                service,
                &mut properties,
                K_CF_ALLOCATOR_DEFAULT,
                0,
            );

            if result != 0 {
                IOObjectRelease(service);
                return Err("Failed to get properties".to_string());
            }

            let dict = CFDictionary::<*const c_void, *const c_void>::wrap_under_create_rule(
                properties as *const _,
            );
            let key = CFString::from_static_string("HIDIdleTime");
            let key_ref = key.as_concrete_TypeRef();

            if let Some(value_ref) = dict.find(key_ref as *const _) {
                let value_ptr = *value_ref;
                let idle_number = CFNumber::wrap_under_get_rule(value_ptr as *const _);
                if let Some(idle_ns) = idle_number.to_i64() {
                    IOObjectRelease(service);
                    return Ok((idle_ns / 1_000_000) as u64);
                }
            }

            IOObjectRelease(service);
            Err("HIDIdleTime not found".to_string())
        }
    }

    #[cfg(not(target_os = "macos"))]
    {
        Ok(0)
    }
}

#[cfg(target_os = "macos")]
#[allow(unexpected_cfgs, deprecated)]
fn apply_macos_window_radius(window: &WebviewWindow, radius: f64) {
    use cocoa::base::id;
    use objc::runtime::{NO, YES};
    use objc::{class, msg_send, sel, sel_impl};

    unsafe {
        if let Ok(ns_window_ptr) = window.ns_window() {
            let ns_window: id = ns_window_ptr as id;

            let content_view: id = msg_send![ns_window, contentView];
            let _: () = msg_send![content_view, setWantsLayer: YES];
            let layer: id = msg_send![content_view, layer];
            if !layer.is_null() {
                let _: () = msg_send![layer, setCornerRadius: radius];
                let _: () = msg_send![layer, setMasksToBounds: YES];
            }

            let _: () = msg_send![ns_window, setOpaque: NO];
            let clear_color: id = msg_send![class!(NSColor), clearColor];
            let _: () = msg_send![ns_window, setBackgroundColor: clear_color];
        }
    }
}

#[cfg(desktop)]
fn place_window_near_tray(window: &WebviewWindow, position: PhysicalPosition<f64>, icon_size: tauri::PhysicalSize<f64>) -> &'static str {
    let default_width = 360_i32;
    let default_height = 572_i32;
    let margin = 8_i32;

    let (window_width, window_height) = match window.outer_size() {
        Ok(size) => (size.width as i32, size.height as i32),
        Err(_) => (default_width, default_height),
    };

    let mut x = (position.x + (icon_size.width / 2.0) - (f64::from(window_width) / 2.0)).round() as i32;

    let tray_at_top = if let Ok(Some(monitor)) = window.current_monitor() {
        let screen_height = monitor.size().height as f64;
        position.y < screen_height / 2.0
    } else {
        cfg!(target_os = "macos")
    };

    let mut y;
    let arrow_dir;

    if tray_at_top {
        y = (position.y).round() as i32;
        arrow_dir = "top";
    } else {
        y = (position.y - f64::from(window_height)).round() as i32;
        arrow_dir = "bottom";
    }

    if let Ok(Some(monitor)) = window.current_monitor() {
        let monitor_pos = monitor.position();
        let monitor_size = monitor.size();
        let min_x = monitor_pos.x;
        let min_y = monitor_pos.y;
        let max_x = min_x + monitor_size.width as i32;
        let max_y = min_y + monitor_size.height as i32;

        if x + window_width > max_x { x = max_x - window_width - margin; }
        if x < min_x { x = min_x + margin; }
        if y + window_height > max_y { y = max_y - window_height; }
        if y < min_y { y = min_y; }
    }

    let _ = window.set_position(Position::Physical(PhysicalPosition { x, y }));
    arrow_dir
}

#[cfg(desktop)]
fn setup_desktop(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    // Enable autostart on first run only
    if let Ok(data_dir) = app.path().app_data_dir() {
        let marker = data_dir.join(".autostart_configured");
        if !marker.exists() {
            let _ = app.autolaunch().enable();
            let _ = std::fs::create_dir_all(&data_dir);
            let _ = std::fs::write(&marker, "1");
        }
    }

    let window = app.get_webview_window("main").unwrap();
    // Park window off-screen to prevent brief flash on first show
    let _ = window.set_position(Position::Physical(PhysicalPosition { x: -9999, y: -9999 }));
    #[cfg(target_os = "macos")]
    apply_macos_window_radius(&window, 0.0);
    let _ = window.hide();

    // Build tray menu
    let open_editor = MenuItem::with_id(app, "open_editor", "Open Editor", true, None::<&str>)?;
    let sync_now = MenuItem::with_id(app, "sync_now", "Sync Now", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

    let menu = Menu::with_items(app, &[&open_editor, &sync_now, &tauri::menu::PredefinedMenuItem::separator(app)?, &quit])?;

    let _tray = TrayIconBuilder::new()
        .icon(tauri::image::Image::from_bytes(include_bytes!("../icons/tray-icon.png"))?)
        .icon_as_template(true)
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| {
            match event.id.as_ref() {
                "quit" => {
                    std::process::exit(0);
                }
                "open_editor" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.emit("open-editor", ());
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
                "sync_now" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.emit("sync-now", ());
                    }
                }
                _ => {}
            }
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                let window = app.get_webview_window("main").unwrap();
                if window.is_visible().unwrap_or(false) {
                    let _ = window.hide();
                } else {
                    let icon_rect = tray.rect().unwrap().unwrap();
                    let scale = window.scale_factor().unwrap_or(1.0);
                    let tray_pos = icon_rect.position.to_physical::<f64>(scale);
                    let tray_size = icon_rect.size.to_physical::<f64>(scale);
                    let arrow_dir = place_window_near_tray(
                        &window,
                        tray_pos,
                        tray_size,
                    );
                    let _ = window.emit("tray-arrow", arrow_dir);
                    let _ = window.emit("sync-now", ());
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        })
        .build(app)?;

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(desktop)]
    let builder = {
        let b = tauri::Builder::default()
            .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, Some(vec!["--autostart"])))
            .on_window_event(|window, event| {
                if let WindowEvent::Focused(false) = event {
                    let _ = window.hide();
                }
            });
        b
    };

    #[cfg(not(desktop))]
    let builder = tauri::Builder::default();

    builder
        .plugin(tauri_plugin_geolocation::init())
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![get_system_idle_time])
        .setup(|_app| {
            #[cfg(desktop)]
            setup_desktop(_app)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
