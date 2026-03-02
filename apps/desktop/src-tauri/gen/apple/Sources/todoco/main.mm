#include "bindings/bindings.h"
#import <UIKit/UIKit.h>
#import <WebKit/WebKit.h>
#import <objc/runtime.h>

// Recursively find and configure WKWebView instances
static void configureWebViews(UIView *view, UIColor *bgColor) {
    if (!view) return;
    if ([view isKindOfClass:[WKWebView class]]) {
        WKWebView *webView = (WKWebView *)view;
        webView.backgroundColor = bgColor;
        webView.opaque = YES;
        webView.scrollView.backgroundColor = bgColor;
        webView.scrollView.bounces = NO;
        webView.scrollView.alwaysBounceVertical = NO;
        webView.scrollView.alwaysBounceHorizontal = NO;
        webView.scrollView.contentInsetAdjustmentBehavior = UIScrollViewContentInsetAdjustmentNever;
    }
    for (UIView *subview in view.subviews) {
        configureWebViews(subview, bgColor);
    }
}

@implementation UIView (MobileSetup)
+ (void)load {
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        // 1. Hide keyboard accessory view (Done/arrows toolbar)
        Class cls = NSClassFromString(@"WKContentView");
        if (cls) {
            SEL original = @selector(inputAccessoryView);
            Method m = class_getInstanceMethod(cls, original);
            if (m) {
                UIView * (^nilBlock)(id) = ^UIView *(id _self) {
                    return nil;
                };
                IMP newImp = imp_implementationWithBlock(nilBlock);
                method_setImplementation(m, newImp);
            }
        }

        // 2. After app launches, set native backgrounds and disable WKWebView bounce
        [[NSNotificationCenter defaultCenter]
            addObserverForName:UIApplicationDidFinishLaunchingNotification
            object:nil
            queue:[NSOperationQueue mainQueue]
            usingBlock:^(NSNotification *note) {
                dispatch_after(
                    dispatch_time(DISPATCH_TIME_NOW, (int64_t)(0.5 * NSEC_PER_SEC)),
                    dispatch_get_main_queue(), ^{
                        UIColor *bgColor = [UIColor colorWithRed:248.0/255.0
                                                           green:250.0/255.0
                                                            blue:252.0/255.0
                                                           alpha:1.0];
                        for (UIScene *scene in UIApplication.sharedApplication.connectedScenes) {
                            if ([scene isKindOfClass:[UIWindowScene class]]) {
                                UIWindowScene *ws = (UIWindowScene *)scene;
                                for (UIWindow *w in ws.windows) {
                                    w.backgroundColor = bgColor;
                                    if (w.rootViewController) {
                                        w.rootViewController.view.backgroundColor = bgColor;
                                    }
                                    configureWebViews(w, bgColor);
                                }
                            }
                        }
                    }
                );
            }];
    });
}
@end

int main(int argc, char * argv[]) {
	ffi::start_app();
	return 0;
}
