import Expo
import FirebaseCore
import FirebaseMessaging
import React
import UserNotifications

// @generated begin react-native-maps-import - expo prebuild (DO NOT MODIFY) sync-bee50fec513f89284e0fa3f5d935afdde33af98f
#if canImport(GoogleMaps)
import GoogleMaps
#endif
// @generated end react-native-maps-import
@UIApplicationMain
public class AppDelegate: ExpoAppDelegate, MessagingDelegate, UNUserNotificationCenterDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ExpoReactNativeFactoryDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    // Firebase must be configured before Messaging / FCM token requests.
    // @generated begin @react-native-firebase/app-didFinishLaunchingWithOptions - expo prebuild (DO NOT MODIFY)
    FirebaseApp.configure()
    // @generated end @react-native-firebase/app-didFinishLaunchingWithOptions

    Messaging.messaging().delegate = self
    UNUserNotificationCenter.current().delegate = self
    application.registerForRemoteNotifications()

    let delegate = ReactNativeDelegate()
    let factory = ExpoReactNativeFactory(delegate: delegate)

    reactNativeDelegate = delegate
    reactNativeFactory = factory
    bindReactNativeFactory(factory)

#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
#endif

// @generated begin react-native-maps-init - expo prebuild (DO NOT MODIFY) sync-84ff3f3390649fd731927a8a87de67bf3a8e9091
#if canImport(GoogleMaps)
GMSServices.provideAPIKey("AIzaSyAa8QYUOOYJ8QHNxUe3_R3PwxRBRVE51ZY")
#endif
// @generated end react-native-maps-init
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  // APNs device token → FCM (required for real FCM registration tokens on iOS).
  public override func application(
    _ application: UIApplication,
    didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
  ) {
    Messaging.messaging().apnsToken = deviceToken
    NSLog("[FCM] APNs device token registered (bytes=\(deviceToken.count))")
    super.application(application, didRegisterForRemoteNotificationsWithDeviceToken: deviceToken)
  }

  public override func application(
    _ application: UIApplication,
    didFailToRegisterForRemoteNotificationsWithError error: Error
  ) {
    NSLog("[FCM] Failed to register for remote notifications: \(error.localizedDescription)")
    super.application(application, didFailToRegisterForRemoteNotificationsWithError: error)
  }

  // Linking API
  public override func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    return super.application(app, open: url, options: options) || RCTLinkingManager.application(app, open: url, options: options)
  }

  // Universal Links
  public override func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
  ) -> Bool {
    let result = RCTLinkingManager.application(application, continue: userActivity, restorationHandler: restorationHandler)
    return super.application(application, continue: userActivity, restorationHandler: restorationHandler) || result
  }

  // MARK: - UNUserNotificationCenterDelegate (foreground + tap)

  public func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    willPresent notification: UNNotification,
    withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
  ) {
    // Show banner/sound while app is foregrounded (FCM notification payloads).
    if #available(iOS 14.0, *) {
      completionHandler([.banner, .list, .sound, .badge])
    } else {
      completionHandler([.alert, .sound, .badge])
    }
  }

  public func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    didReceive response: UNNotificationResponse,
    withCompletionHandler completionHandler: @escaping () -> Void
  ) {
    // Let Expo / RN notification modules observe the tap as well.
    completionHandler()
  }

  // MARK: - MessagingDelegate
  public func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String?) {
    // Token refresh is also observed in JS via onTokenRefresh; log for native diagnostics.
    if let fcmToken, !fcmToken.isEmpty {
      NSLog("[FCM] Registration token refreshed (len=\(fcmToken.count))")
    }
  }
}

class ReactNativeDelegate: ExpoReactNativeFactoryDelegate {
  // Extension point for config-plugins

  override func sourceURL(for bridge: RCTBridge) -> URL? {
    // needed to return the correct URL for expo-dev-client.
    bridge.bundleURL ?? bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: ".expo/.virtual-metro-entry")
#else
    return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
