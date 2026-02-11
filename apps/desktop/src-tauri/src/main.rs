#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{
    CustomMenuItem, Manager, PhysicalPosition, Position, SystemTray, SystemTrayEvent,
    SystemTrayMenu, Window, WindowEvent,
};

#[tauri::command]
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
                // Dereference ItemRef to get the actual pointer
                let value_ptr = *value_ref;
                let idle_number = CFNumber::wrap_under_get_rule(value_ptr as *const _);
                if let Some(idle_ns) = idle_number.to_i64() {
                    IOObjectRelease(service);
                    // HIDIdleTime is in nanoseconds, convert to milliseconds
                    return Ok((idle_ns / 1_000_000) as u64);
                }
            }

            IOObjectRelease(service);
            Err("HIDIdleTime not found".to_string())
        }
    }

    #[cfg(not(target_os = "macos"))]
    {
        Ok(0) // Fallback for non-macOS platforms
    }
}

#[cfg(target_os = "macos")]
fn apply_macos_window_radius(window: &Window, radius: f64) {
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

/// Returns "top" if tray is at top of screen (macOS), "bottom" if at bottom (Windows).
fn place_window_near_tray(window: &Window, tray_position: PhysicalPosition<f64>, tray_size: tauri::PhysicalSize<f64>) -> &'static str {
    let default_width = 360_i32;
    let default_height = 572_i32;
    let margin = 8_i32;

    let (window_width, window_height) = match window.outer_size() {
        Ok(size) => (size.width as i32, size.height as i32),
        Err(_) => (default_width, default_height),
    };

    let mut x = (tray_position.x + (tray_size.width / 2.0) - (f64::from(window_width) / 2.0)).round() as i32;

    // Determine if tray is at top or bottom of screen
    let tray_at_top = if let Ok(Some(monitor)) = window.current_monitor() {
        let screen_height = monitor.size().height as f64;
        tray_position.y < screen_height / 2.0
    } else {
        cfg!(target_os = "macos") // fallback: macOS=top, others=bottom
    };

    let mut y;
    let arrow_dir;

    if tray_at_top {
        // macOS: tray at top — window goes below, arrow points up
        y = (tray_position.y).round() as i32;
        arrow_dir = "top";
    } else {
        // Windows: tray at bottom — window goes above, arrow points down
        y = (tray_position.y - f64::from(window_height)).round() as i32;
        arrow_dir = "bottom";
    }

    // Keep window within screen bounds
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

fn main() {
    let open_editor = CustomMenuItem::new("open_editor".to_string(), "Open Editor");
    let sync_now = CustomMenuItem::new("sync_now".to_string(), "Sync Now");
    let quit = CustomMenuItem::new("quit".to_string(), "Quit");

    let tray_menu = SystemTrayMenu::new()
        .add_item(open_editor)
        .add_item(sync_now)
        .add_native_item(tauri::SystemTrayMenuItem::Separator)
        .add_item(quit);

    let system_tray = SystemTray::new()
        .with_menu(tray_menu)
        .with_menu_on_left_click(false);

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![get_system_idle_time])
        .system_tray(system_tray)
        .on_window_event(|event| {
            if let WindowEvent::Focused(false) = event.event() {
                let _ = event.window().hide();
            }
        })
        .on_system_tray_event(|app, event| match event {
            SystemTrayEvent::LeftClick { position, size, .. } => {
                let window = app.get_window("main").unwrap();
                if window.is_visible().unwrap_or(false) {
                    let _ = window.hide();
                } else {
                    let arrow_dir = place_window_near_tray(&window, position, size);
                    let _ = window.emit("tray-arrow", arrow_dir);
                    let _ = window.emit("sync-now", {});
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            SystemTrayEvent::MenuItemClick { id, .. } => match id.as_str() {
                "quit" => {
                    std::process::exit(0);
                }
                "open_editor" => {
                    if let Some(window) = app.get_window("main") {
                        let _ = window.emit("open-editor", {});
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
                "sync_now" => {
                    if let Some(window) = app.get_window("main") {
                        let _ = window.emit("sync-now", {});
                    }
                }
                _ => {}
            },
            _ => {}
        })
        .setup(|app| {
            let window = app.get_window("main").unwrap();
            #[cfg(target_os = "macos")]
            apply_macos_window_radius(&window, 0.0);
            let _ = window.hide();
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
