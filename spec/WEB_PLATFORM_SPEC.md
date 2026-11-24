\# WEB\_PLATFORM\_SPEC.md

\# Spin Legends — Web Platform Specification



\*\*Document Type:\*\* Platform Extension Specification  

\*\*Product:\*\* Spin Legends  

\*\*Target Platform:\*\* Web Browsers  

\*\*Rendering Technology:\*\* Unity WebGL / Web Platform Build  

\*\*Document Status:\*\* Proposed  

\*\*Relationship:\*\* Extension to SPEC.md, GAME\_DESIGN.md, TECHNICAL\_DESIGN.md, and DEVELOPMENT\_ROADMAP.md



\---



\## 1. Purpose



This document defines the modifications, constraints, technical requirements, and development considerations required to deliver Spin Legends as a browser-based game.



The objective is to make Spin Legends playable directly through a modern web browser without requiring a traditional desktop installation or a dedicated mobile application.



The web version must preserve the core gameplay experience while adapting rendering, physics, input handling, asset delivery, memory usage, persistence, and performance to browser environments.



This document supplements the existing product specifications. It does not replace the original game design.



\## 2. Platform Strategy



\### 2.1 Supported Platforms



The product will target three deployment environments:



\- Windows Desktop

\- Android

\- Web Browsers



The web version must support both desktop and mobile browsers.



\### 2.2 Browser Support



The initial supported browser targets are:



\- Google Chrome

\- Microsoft Edge

\- Mozilla Firefox

\- Safari



Browser compatibility must be validated against actual supported versions during development.



The implementation must detect unsupported browser capabilities and provide a clear compatibility message instead of failing silently.



\### 2.3 Web Distribution



The game must be accessible through a standard HTTPS URL.



The web deployment must support:



\- Direct game launch from a website.

\- Full-screen gameplay.

\- Responsive browser layouts.

\- Loading and initialization screens.

\- Version-aware asset delivery.

\- Browser refresh and recovery handling.

\- Optional installation through Progressive Web App capabilities where supported.



The game must not require users to install a native application.



\## 3. Core Web Platform Requirements



\### 3.1 Web-First Runtime



The web build must be designed around browser execution constraints.



The following requirements apply:



\- No dependency on native operating system APIs.

\- No unrestricted filesystem access.

\- No native executable or plugin installation.

\- No mandatory external launcher.

\- No dependency on persistent browser storage being available.

\- No assumption that the browser tab remains active continuously.

\- No assumption that the game has unlimited memory or GPU resources.



Platform-specific functionality must be accessed through compatible abstraction layers.



\### 3.2 Web Build Architecture



The web implementation must separate platform-independent gameplay systems from platform-specific services.



Core gameplay systems must not directly depend on:



\- Browser JavaScript APIs.

\- IndexedDB.

\- LocalStorage.

\- Browser-specific input APIs.

\- Web-specific networking implementations.



These capabilities must be accessed through interfaces or adapters.



Recommended abstraction boundaries:



\- Platform Services

\- Storage Services

\- Input Services

\- Audio Services

\- Network Services

\- Browser Lifecycle Services

\- Analytics Services



This separation must allow the same gameplay logic to run on desktop, Android, and web builds.



\## 4. Gameplay Adaptations



\### 4.1 Combat Simulation



The physics-driven combat system must be optimized for browser execution.



Requirements:



\- Maintain stable simulation behavior across supported browsers.

\- Avoid unnecessary physics calculations.

\- Limit active rigid bodies and collision complexity.

\- Use simplified collision geometry where possible.

\- Avoid expensive continuous collision detection unless necessary.

\- Keep physics simulation independent of rendering frame rate.

\- Support controlled simulation quality levels.



The combat simulation must preserve meaningful mechanical behavior.



Performance optimizations must not eliminate the importance of:



\- Mass distribution.

\- Angular momentum.

\- Rotational energy loss.

\- Collision impulse.

\- Friction.

\- Ground contact.

\- Stability.

\- Linear movement.



\### 4.2 Simulation and Rendering Separation



Physics simulation and visual rendering must use separate update strategies.



The simulation must use a controlled fixed timestep.



Rendering must adapt to the browser's available frame rate.



The system must handle:



\- Variable rendering frame rates.

\- Temporary frame drops.

\- Browser tab suspension.

\- Device throttling.

\- Visibility changes.

\- Browser lifecycle interruptions.



The game must never attempt to process an unlimited accumulated simulation backlog after a long frame interruption.



\### 4.3 Background Suspension



When the browser tab becomes inactive or the device suspends execution:



\- Pause nonessential visual updates.

\- Stop unnecessary audio playback.

\- Suspend nonessential background processing.

\- Preserve the current battle state where possible.

\- Prevent simulation time from advancing uncontrollably.



For single-player battles, the game must follow a consistent pause or interruption policy.



The default policy should pause the battle when the page becomes hidden.



\## 5. Input System



\### 5.1 Desktop Browser Input



Supported input methods:



\- Mouse

\- Keyboard

\- Optional gamepad support where browser APIs permit it



The desktop control system must support:



\- Workshop interaction.

\- Component selection.

\- Camera interaction.

\- Battle Mode selection.

\- Tactical Commands.

\- Active Abilities.

\- Menu navigation.



\### 5.2 Mobile Browser Input



The mobile web version must provide touch-friendly controls.



Requirements:



\- Large interactive touch targets.

\- Responsive HUD positioning.

\- No dependence on hover interactions.

\- Support for portrait and landscape layouts where appropriate.

\- Prevention of accidental browser gestures during active gameplay where permitted.

\- Support for touch-based camera interaction.



The primary battle controls must remain usable without a physical keyboard.



\### 5.3 Input Abstraction



All gameplay actions must be routed through a unified input abstraction.



The combat system must not directly depend on mouse, keyboard, or touch events.



Example logical actions:



\- SelectBattleMode

\- IssueTacticalCommand

\- ActivateAbility

\- ChangeCameraView

\- PauseBattle

\- ConfirmSelection



Each platform maps its physical input methods to these logical actions.



\## 6. Graphics and Rendering



\### 6.1 Rendering Pipeline



The web version must use a browser-compatible rendering pipeline.



For a Unity implementation, WebGL-compatible rendering must be used rather than assuming all desktop rendering features are available.



The rendering configuration must be validated against the target browser and GPU combinations.



\### 6.2 Graphics Quality Profiles



The game must provide scalable quality profiles.



\*\*Low\*\*

\- Reduced shadow quality.

\- Simplified particle effects.

\- Reduced transparency effects.

\- Lower texture resolution.

\- Reduced environmental detail.



\*\*Medium\*\*

\- Standard texture quality.

\- Limited real-time shadows.

\- Moderate particle density.

\- Standard arena detail.



\*\*High\*\*

\- Higher texture resolution.

\- Enhanced lighting.

\- Higher particle density.

\- Additional visual effects where supported.



The default profile should be selected based on device capabilities.



\### 6.3 Visual Optimization



The following techniques should be considered:



\- GPU instancing.

\- Object pooling.

\- Mesh optimization.

\- Texture compression.

\- Level of Detail.

\- Occlusion culling where useful.

\- Reduced material count.

\- Shader complexity reduction.

\- Efficient particle systems.

\- Baked lighting where appropriate.



The game must avoid unnecessary visual effects that reduce combat readability.



\### 6.4 Graphics Fallback



If a browser or GPU does not support a required rendering feature:



\- Disable the unsupported feature.

\- Use a compatible fallback.

\- Preserve core gameplay.

\- Display an informative message only when functionality is materially affected.



\## 7. Asset Delivery and Loading



\### 7.1 Initial Download



The initial game download must be kept as small as reasonably possible.



The loading experience must not require downloading every arena, component, cosmetic item, and visual asset before the first playable session.



\### 7.2 Asset Groups



Assets should be divided into independently loadable groups:



\- Core Runtime

\- Main Menu

\- Initial Arena

\- Initial Top Collection

\- Workshop

\- Audio

\- Additional Arenas

\- Additional Components

\- Cosmetics

\- Optional Content



The first playable session should require only the core runtime and initial gameplay assets.



\### 7.3 Progressive Asset Loading



The game must support progressive asset loading.



Requirements:



\- Load essential assets first.

\- Load optional assets in the background when appropriate.

\- Load additional arenas when needed.

\- Avoid duplicate downloads.

\- Support asset caching.

\- Handle interrupted downloads.

\- Validate downloaded asset versions.

\- Provide clear loading progress.



\### 7.4 Asset Bundling



The implementation must use a suitable asset delivery strategy for the selected Unity version.



Addressables or an equivalent asset delivery system may be used.



Asset groups must be versioned independently where practical.



A content update should not require downloading the entire game again unless the runtime itself changes.



\### 7.5 CDN Support



Static game assets should be delivered through a CDN.



The deployment must support:



\- HTTPS.

\- Compression.

\- Cache-Control policies.

\- Content hashing.

\- Versioned asset paths.

\- CORS configuration.

\- Appropriate MIME types.

\- Range requests where required by the chosen delivery mechanism.



\## 8. Memory and Performance Management



\### 8.1 Memory Constraints



Browser memory availability is limited and varies by device.



The game must not assume that desktop browser memory limits are available on Android.



Memory usage must be measured on real target devices.



Requirements:



\- Avoid unnecessary runtime allocations.

\- Reuse temporary objects.

\- Pool frequently created objects.

\- Release unused assets.

\- Avoid loading multiple high-resolution arenas simultaneously.

\- Limit texture memory.

\- Monitor memory pressure.

\- Handle allocation failures gracefully.



\### 8.2 Performance Targets



Initial engineering targets:



| Metric | Target |

|---|---|

| Desktop Frame Rate | 60 FPS |

| Mobile Frame Rate | 30–60 FPS |

| Battle Duration | 60–120 seconds |

| Initial Playable Load | As fast as practical; target under 15 seconds on a defined reference connection |

| UI Response | Under 100 ms |

| Physics Stability | No persistent simulation instability |

| Memory | Within tested browser/device budgets |



These targets are provisional and must be validated through profiling.



The initial loading target must be measured separately from subsequent cached launches.



\### 8.3 Adaptive Quality



The game should monitor performance indicators and adjust visual quality when necessary.



Possible adjustments:



\- Particle density.

\- Shadow resolution.

\- Render scale.

\- Post-processing.

\- Texture quality for subsequently loaded content.

\- Environmental effects.



Adaptive quality must not modify competitive gameplay attributes or physics rules.



\## 9. Audio



\### 9.1 Browser Audio Restrictions



The browser may prevent audio playback before user interaction.



The game must provide an explicit initial interaction to activate audio.



Requirements:



\- Initialize audio after user interaction.

\- Support mute and volume controls.

\- Handle browser audio suspension.

\- Resume audio safely when permitted.

\- Avoid unnecessary simultaneous audio sources.



\### 9.2 Audio Optimization



Audio assets must be compressed appropriately.



The game should use:



\- Compressed audio formats supported by the target browsers.

\- Short sound effects for frequent combat events.

\- Audio pooling or controlled voice limits.

\- Adaptive sound mixing.

\- Reduced audio complexity on low-end devices.



Rotational audio must remain responsive to spinning speed without generating excessive audio processing overhead.



\## 10. Persistence and Save Data



\### 10.1 Browser Storage



The web version must support persistent local saves.



Recommended storage strategy:



\- IndexedDB for structured game data.

\- Cache Storage for suitable static assets.

\- In-memory storage for temporary session state.



LocalStorage must not be used as the primary storage mechanism for large game data.



\### 10.2 Save Data Requirements



The save system must preserve:



\- Player profile.

\- Top collection.

\- Component inventory.

\- Equipment configurations.

\- Progression.

\- Experience.

\- Evolution.

\- Unlocked abilities.

\- Currency and resources.

\- Tournament progress.

\- Settings.



\### 10.3 Save Reliability



Requirements:



\- Versioned save schemas.

\- Migration support.

\- Atomic or recoverable writes.

\- Data validation.

\- Corruption detection.

\- Safe handling of quota errors.

\- Recovery from interrupted writes.

\- Duplicate reward prevention.



The game must clearly inform users when browser storage is unavailable or persistence cannot be guaranteed.



\### 10.4 Cross-Device Progression



Local browser saves are not automatically shared across devices.



Cloud synchronization must be implemented as a separate optional service.



Future cloud saves should support:



\- Account authentication.

\- Server-side validation.

\- Conflict detection.

\- Versioned save synchronization.

\- Recovery from failed synchronization.



The game must remain playable without an account in the initial single-player web release.



\## 11. Networking and Multiplayer Readiness



\### 11.1 Initial Release



The initial web release must support offline single-player gameplay.



Internet access is required for downloading the game and optional content, but an active connection must not be required for every local battle.



\### 11.2 Future Multiplayer



The architecture must remain compatible with future browser-based multiplayer.



Potential networking capabilities include:



\- WebSocket.

\- WebRTC.

\- Secure HTTPS APIs.



The final transport selection must be made after multiplayer architecture and hosting requirements are defined.



\### 11.3 Simulation Authority



The web client must not be considered a trusted authority for competitive progression or rewards.



Future online competitive systems must use server-side validation.



The design must account for the fact that Unity physics simulation is not inherently deterministic across all devices.



Potential future approaches include:



\- Server-authoritative simulation.

\- Validated client inputs.

\- State snapshots.

\- Controlled reconciliation.

\- Replay verification.

\- Anti-cheat validation.



Multiplayer support is not part of the initial web MVP.



\## 12. Browser Lifecycle and Reliability



The game must handle browser lifecycle events.



Required scenarios:



\- Page refresh.

\- Tab switching.

\- Browser suspension.

\- Device screen locking.

\- Temporary network loss.

\- Asset download interruption.

\- Storage quota exhaustion.

\- Browser crash.

\- Unexpected application termination.



The game must distinguish between recoverable and nonrecoverable failures.



A failed asset download must not silently corrupt local game data.



A browser refresh must not award duplicate battle rewards.



\## 13. Web Security



The web version must follow standard web security practices.



Requirements:



\- HTTPS-only production deployment.

\- Secure content delivery.

\- Strict validation of externally supplied data.

\- No embedded secrets in client builds.

\- No trust in client-side currency or progression values.

\- Appropriate Content Security Policy.

\- Correct CORS configuration.

\- Safe handling of user-generated content if introduced.

\- Protection against duplicate reward submissions.



All sensitive future account and progression operations must be validated server-side.



\## 14. User Interface Adaptation



\### 14.1 Responsive Layout



The interface must adapt to:



\- Desktop browsers.

\- Tablets.

\- Mobile browsers.

\- Different aspect ratios.

\- Different viewport dimensions.



The layout must not assume a fixed resolution.



\### 14.2 Web Loading Experience



The web version must include:



\- Initial loading screen.

\- Download progress.

\- Initialization progress.

\- Error and retry states.

\- Browser compatibility information.

\- Audio activation interaction.



\### 14.3 Fullscreen



Fullscreen mode should be supported where browser APIs permit it.



The game must remain usable when fullscreen is unavailable.



The interface must account for browser UI and mobile safe areas.



\## 15. Progressive Web App Considerations



PWA functionality may be introduced as an optional enhancement.



Potential features:



\- Installable application shortcut.

\- App icon.

\- Application manifest.

\- Offline access to previously cached content.

\- Launch experience without visible browser chrome where supported.



PWA installation must not be a requirement for playing the game.



Service Worker caching must be version-aware and must not leave users with incompatible runtime and asset versions.



\## 16. Deployment Architecture



\### 16.1 Static Hosting



The web build should be deployable through static hosting and a CDN.



The initial release should not require a dedicated game server.



\### 16.2 Deployment Components



Recommended deployment structure:



\- Web Application Shell

\- Unity Web Build

\- Runtime Configuration

\- Versioned Asset Storage

\- CDN

\- Optional Backend API

\- Optional Authentication Service

\- Optional Cloud Save Service



\### 16.3 Deployment Requirements



The hosting environment must support:



\- HTTPS.

\- Correct MIME types.

\- Brotli or Gzip compression.

\- Cross-Origin Resource Sharing.

\- Correct cache policies.

\- Large asset delivery.

\- Versioned deployment.

\- Rollback to a previous release.



\### 16.4 Release Versioning



Every web release must have a unique build identifier.



The client must be able to detect incompatible cached assets and request an update.



A deployment must never combine incompatible runtime and content versions.



\## 17. Technology Requirements



\### 17.1 Engine



Unity 6 LTS remains the preferred engine, subject to confirmation that the selected release and required packages support the intended Web platform target.



\### 17.2 Rendering



Use a browser-compatible rendering configuration.



The implementation must validate WebGL requirements and the supported browser feature set.



\### 17.3 Programming



C# remains the primary gameplay programming language.



JavaScript may be used for browser integration through a narrowly scoped interoperability layer.



Browser-specific code must remain isolated from core gameplay modules.



\### 17.4 Web Integration



Potential integration areas:



\- Browser fullscreen.

\- Visibility events.

\- Audio activation.

\- IndexedDB persistence.

\- PWA lifecycle.

\- Browser diagnostics.

\- Optional JavaScript-based asset and storage integrations.



All integrations must have fallback behavior.



\## 18. Revised MVP Scope for Web



The web MVP must preserve the original gameplay MVP while adapting the delivery scope.



\### 18.1 Required Features



\- Browser launch.

\- Desktop and mobile browser support.

\- Responsive UI.

\- Initial arena.

\- Six initial top designs.

\- Core component assembly.

\- Basic component customization.

\- Physics-driven combat.

\- Five Battle Modes.

\- Six Tactical Commands.

\- Twelve initial Active Abilities.

\- AI opponents.

\- Training mode.

\- Tournament mode.

\- Basic progression.

\- Local save persistence.

\- Browser-compatible audio.

\- Graphics quality profiles.

\- Loading and error handling.



\### 18.2 Deferred Features



The following features are not required for the initial web release:



\- Multiplayer.

\- Ranked competition.

\- Global leaderboards.

\- Trading.

\- Guilds.

\- Social systems.

\- Cloud progression synchronization.

\- Mandatory user accounts.

\- Advanced PWA functionality.

\- Browser-based modding.

\- User-generated content.

\- Real-money purchases.



\## 19. Web Development Roadmap Adjustments



The existing development roadmap must be extended with a web-specific validation track.



\### Phase W0 — Web Feasibility



Objectives:



\- Validate the selected Unity version's web build support.

\- Create a minimal browser build.

\- Test browser startup.

\- Test GPU compatibility.

\- Measure memory usage.

\- Validate audio activation.

\- Test desktop and Android browsers.



Exit criteria:



\- A minimal build launches successfully on the selected reference browsers.

\- The initial rendering pipeline is functional.

\- Browser-specific limitations are documented.



\### Phase W1 — Web Physics Prototype



Objectives:



\- Port the initial spinning simulation.

\- Validate fixed timestep behavior.

\- Measure physics performance.

\- Test collision behavior.

\- Test browser suspension and resumption.

\- Validate mobile performance.



Exit criteria:



\- The simulation remains stable under target performance conditions.

\- The core combat loop can run in a browser.



\### Phase W2 — Web Vertical Slice



Objectives:



\- Integrate one arena.

\- Integrate a playable top.

\- Implement core combat controls.

\- Implement one AI opponent.

\- Integrate basic audio.

\- Implement responsive HUD.

\- Add loading and recovery states.



Exit criteria:



\- A complete battle can be played in desktop and mobile browsers.



\### Phase W3 — Web Platform Integration



Objectives:



\- Implement persistent browser saves.

\- Integrate progressive asset loading.

\- Implement graphics quality profiles.

\- Integrate browser lifecycle handling.

\- Validate browser compatibility.

\- Implement versioned asset delivery.



Exit criteria:



\- The web build supports a complete local gameplay session with persistent progression.



\### Phase W4 — Web Optimization and Release



Objectives:



\- Profile target browsers.

\- Optimize loading.

\- Optimize memory usage.

\- Optimize rendering and physics.

\- Validate deployment configuration.

\- Run compatibility and recovery tests.

\- Prepare production release.



Exit criteria:



\- The web build passes the defined quality gates.

\- No critical browser-specific issues remain.



\## 20. Web Acceptance Criteria



The web version is considered ready for its initial release when:



1\. Users can launch the game through an HTTPS URL.

2\. The game works on the supported desktop browsers.

3\. The game works on the selected supported Android browsers.

4\. Desktop and touch controls are functional.

5\. The complete initial gameplay loop is available.

6\. Combat physics remain stable.

7\. The game can pause safely when the browser tab becomes inactive.

8\. Local progression is persisted reliably.

9\. The game handles interrupted downloads.

10\. Cached assets cannot silently conflict with a newer runtime.

11\. Performance targets are met on the defined reference devices.

12\. Unsupported browser capabilities are handled gracefully.

13\. No mandatory account or native installation is required.



\## 21. Important Architectural Decisions



The following decisions are mandatory for the web implementation:



\- Gameplay logic must remain platform-independent.

\- Browser APIs must be isolated behind platform services.

\- Physics simulation must not depend on rendering frame rate.

\- Asset delivery must be progressive.

\- Memory usage must be measured and controlled.

\- Local persistence must support versioning and recovery.

\- The initial release must work without multiplayer infrastructure.

\- Future online progression must use server-side validation.

\- The web build must not introduce a separate gameplay implementation.

\- Desktop, Android, and web versions must share the same core game rules.



\## 22. Final Product Principle



Spin Legends must be designed as one game with multiple deployment targets.



The web version is not a reduced demonstration with a separate gameplay architecture.



It must provide a complete, playable, and maintainable experience while respecting the technical constraints of modern browsers.



The quality of the web implementation must be measured by gameplay consistency, responsiveness, accessibility, loading performance, and reliability—not merely by whether the game successfully launches inside a browser.

