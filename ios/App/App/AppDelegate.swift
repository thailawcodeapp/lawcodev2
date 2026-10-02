import UIKit
import Capacitor
import AVFoundation

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Firebase is configured automatically by @capacitor-firebase/app's
        // load() — no manual FirebaseApp.configure() needed here. What matters
        // is that GoogleService-Info.plist is bundled as an app resource (see
        // project.pbxproj), otherwise configure() crashes on launch.

        // Keep text-to-speech playing when the screen is locked / app is in the
        // background (headphones, car Bluetooth) — matching Android. The TTS
        // plugin ignores its `category` option and uses its own audio session,
        // so we configure the shared session here. Needs UIBackgroundModes
        // 'audio' in Info.plist to actually continue while backgrounded.
        do {
            try AVAudioSession.sharedInstance().setCategory(
                .playback, mode: .spokenAudio, options: [])
            try AVAudioSession.sharedInstance().setActive(true)
        } catch {
            print("[Audio] session setup failed: \(error)")
        }
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.

        // iPad: returning from the background sometimes leaves the view
        // hierarchy (and the WKWebView inside it) wedged at whatever size it
        // had when backgrounded, even though the window's own frame is
        // already correct — nothing tells the layout system to re-measure.
        // The JS-side rescale (App.jsx's appStateChange listener) reads
        // window.innerWidth/innerHeight, which just reports back whatever
        // this stale native layout already believes, so it can't fix this on
        // its own. Forcing a fresh layout pass — not overriding the frame —
        // respects whatever size Stage Manager actually gave the window.
        window?.rootViewController?.view.setNeedsLayout()
        window?.rootViewController?.view.layoutIfNeeded()
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}
