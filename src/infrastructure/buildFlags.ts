/**
 * Build-time feature flags.
 * VITE_DISABLE_DEBUG=1 (set by the Android APK workflow) strips the Training
 * debug drawer and the diagnostics/heatmap overlay from release builds.
 */
export const DEBUG_TOOLS_ALLOWED: boolean = import.meta.env.VITE_DISABLE_DEBUG !== '1';
