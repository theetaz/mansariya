module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    // react-native-reanimated (v4) requires the worklets plugin to be last.
    plugins: ["react-native-worklets/plugin"],
  };
};
