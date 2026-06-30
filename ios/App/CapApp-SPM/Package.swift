// swift-tools-version: 5.9
import PackageDescription

// DO NOT MODIFY THIS FILE - managed by Capacitor CLI commands
let package = Package(
    name: "CapApp-SPM",
    platforms: [.iOS(.v15)],
    products: [
        .library(
            name: "CapApp-SPM",
            targets: ["CapApp-SPM"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", exact: "8.4.1"),
        .package(name: "CapacitorCommunityAdmob", path: "..\..\..\node_modules\@capacitor-community\admob"),
        .package(name: "CapacitorCommunityTextToSpeech", path: "..\..\..\node_modules\@capacitor-community\text-to-speech"),
        .package(name: "CapacitorFirebaseApp", path: "..\..\..\node_modules\@capacitor-firebase\app"),
        .package(name: "CapacitorFirebaseAuthentication", path: "..\..\..\node_modules\@capacitor-firebase\authentication"),
        .package(name: "CapacitorFirebaseFirestore", path: "..\..\..\node_modules\@capacitor-firebase\firestore"),
        .package(name: "CapacitorApp", path: "..\..\..\node_modules\@capacitor\app"),
        .package(name: "CapacitorDevice", path: "..\..\..\node_modules\@capacitor\device"),
        .package(name: "CapacitorPreferences", path: "..\..\..\node_modules\@capacitor\preferences"),
        .package(name: "CapacitorSplashScreen", path: "..\..\..\node_modules\@capacitor\splash-screen"),
        .package(name: "CapacitorStatusBar", path: "..\..\..\node_modules\@capacitor\status-bar"),
        .package(name: "CapgoCapacitorAppTrackingTransparency", path: "..\..\..\node_modules\@capgo\capacitor-app-tracking-transparency"),
        .package(name: "CordovaPluginPurchase", path: "../../capacitor-cordova-ios-plugins/sources/CordovaPluginPurchase")
    ],
    targets: [
        .target(
            name: "CapApp-SPM",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm"),
                .product(name: "CapacitorCommunityAdmob", package: "CapacitorCommunityAdmob"),
                .product(name: "CapacitorCommunityTextToSpeech", package: "CapacitorCommunityTextToSpeech"),
                .product(name: "CapacitorFirebaseApp", package: "CapacitorFirebaseApp"),
                .product(name: "CapacitorFirebaseAuthentication", package: "CapacitorFirebaseAuthentication"),
                .product(name: "CapacitorFirebaseFirestore", package: "CapacitorFirebaseFirestore"),
                .product(name: "CapacitorApp", package: "CapacitorApp"),
                .product(name: "CapacitorDevice", package: "CapacitorDevice"),
                .product(name: "CapacitorPreferences", package: "CapacitorPreferences"),
                .product(name: "CapacitorSplashScreen", package: "CapacitorSplashScreen"),
                .product(name: "CapacitorStatusBar", package: "CapacitorStatusBar"),
                .product(name: "CapgoCapacitorAppTrackingTransparency", package: "CapgoCapacitorAppTrackingTransparency"),
                .product(name: "CordovaPluginPurchase", package: "CordovaPluginPurchase")
            ]
        )
    ]
)
