#!/bin/bash
set -e
cd /Users/muthuramanveerashekar/Desktop/Dev/selorg-combined/customer-app-v1

echo "=== Step 1: Run Expo prebuild ==="
rm -rf android
./node_modules/.bin/expo prebuild --clean

echo ""
echo "=== Step 2: Update gradle.properties ==="
cd android

# Update gradle.properties to fix architecture and parallel settings
sed -i.bak 's/org.gradle.parallel=true/org.gradle.parallel=false/' gradle.properties
sed -i.bak 's/reactNativeArchitectures=armeabi-v7a,arm64-v8a,x86,x86_64/reactNativeArchitectures=arm64-v8a/' gradle.properties

echo "Updated gradle.properties:"
grep "gradle.parallel\|reactNativeArchitectures" gradle.properties

echo ""
echo "=== Step 3: Run Gradle build ==="
./gradlew assembleRelease

echo ""
echo "=== Build complete! ==="
