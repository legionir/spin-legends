\# SPIN LEGENDS

\# EXECUTION BLUEPRINT

\## Web Platform — Engineering Architecture, Data Contracts, Task Backlog \& First Vertical Slice



\*\*Document ID:\*\* SL-EXEC-WEB-001  

\*\*Document Type:\*\* Engineering Execution Specification  

\*\*Product:\*\* Spin Legends  

\*\*Primary Platform:\*\* Web  

\*\*Secondary Platforms:\*\* Windows Desktop, Android  

\*\*Engine:\*\* Unity 6 LTS  

\*\*Rendering Pipeline:\*\* Universal Render Pipeline (URP)  

\*\*Programming Language:\*\* C#  

\*\*Primary Build Target:\*\* WebGL  

\*\*Architecture Style:\*\* Modular, Data-Driven, Platform-Independent Core  

\*\*Status:\*\* Implementation Baseline



\---



\# 1. DOCUMENT PURPOSE



This document converts the existing Spin Legends product and platform specifications into an actionable engineering plan.



It defines:



1\. The actual Unity project structure.

2\. Runtime architecture and module responsibilities.

3\. Physics and spinning simulation architecture.

4\. Data contracts and ScriptableObject definitions.

5\. Platform abstraction contracts.

6\. Complete initial development task backlog.

7\. Task dependencies and implementation order.

8\. Web Feasibility Prototype requirements.

9\. First Vertical Slice scope.

10\. Testing, performance, and acceptance criteria.



This document is the primary engineering reference for the initial implementation.



It supplements:



\- SPEC.md

\- GAME\_DESIGN.md

\- TECHNICAL\_DESIGN.md

\- DEVELOPMENT\_ROADMAP.md

\- WEB\_PLATFORM\_SPEC.md



If an implementation detail conflicts with an existing high-level product requirement, the product requirement takes precedence unless a formal design decision explicitly changes it.



\---



\# 2. ENGINEERING DECISIONS



\## 2.1 Technology Stack



| Area | Technology |

|---|---|

| Game Engine | Unity 6 LTS |

| Programming | C# |

| Rendering | URP |

| Physics | Unity Physics / PhysX |

| Input | Unity Input System |

| Asset Management | Unity Addressables |

| Data Definitions | ScriptableObjects |

| Local Persistence | IndexedDB adapter for Web |

| Desktop Persistence | File-based local storage adapter |

| Android Persistence | Application persistent storage adapter |

| UI | Unity UI Toolkit or uGUI |

| 3D Modeling | Blender |

| Version Control | Git |

| Automated Testing | Unity Test Framework |

| Web Deployment | Static Hosting + CDN |

| Browser Integration | JavaScript Interop |



The exact Unity editor and package versions must be pinned in the repository.



Packages must not be upgraded independently without validating the WebGL build.



\## 2.2 Rendering Pipeline



Use URP with a Web-compatible configuration.



The initial implementation must prioritize:



\- Stable rendering.

\- Low memory consumption.

\- Shader compatibility.

\- Predictable material behavior.

\- Efficient lighting.

\- Controlled particle effects.



Advanced rendering features must be introduced only after browser compatibility is verified.



\## 2.3 Physics Architecture



The simulation must distinguish between:



\- Angular rotation.

\- Linear movement.

\- Rotational energy.

\- Ground contact.

\- Collision response.

\- Stability.

\- Energy consumption.



A spinning top must not be represented as an ordinary moving Rigidbody with an unrelated visual rotation animation.



The physical model must use a controlled combination of Rigidbody simulation and custom rotational state.



Unity Rigidbody does not provide a complete gyroscopic spinning-top simulation out of the box. Therefore, gyroscopic behavior, rotational energy loss, and stability must be modeled explicitly.



\## 2.4 Fixed Simulation Step



Initial simulation target:



\- Physics timestep: 0.02 seconds.

\- Simulation frequency: 50 Hz.

\- Rendering: Independent variable frame rate.

\- Maximum accumulated simulation time: Bounded.

\- Maximum catch-up steps per rendered frame: Configurable.



The initial timestep is a prototype parameter, not a permanent physical constant.



It must be validated against collision stability and browser performance.



\## 2.5 Single Source of Truth



The same gameplay rules must be used across:



\- Web

\- Windows

\- Android



Platform-specific implementations must not duplicate combat rules, progression rules, or equipment calculations.



\---



\# 3. UNITY PROJECT STRUCTURE



The following is the proposed actual repository and Unity project layout.



```text

SpinLegends/

│

├── README.md

├── SPEC.md

├── GAME\_DESIGN.md

├── TECHNICAL\_DESIGN.md

├── DEVELOPMENT\_ROADMAP.md

├── WEB\_PLATFORM\_SPEC.md

├── EXECUTION\_BLUEPRINT.md

│

├── .gitignore

├── .gitattributes

│

├── ProjectSettings/

├── Packages/

│

├── Assets/

│   │

│   ├── \_Project/

│   │   │

│   │   ├── Art/

│   │   │   ├── Materials/

│   │   │   ├── Models/

│   │   │   ├── Textures/

│   │   │   ├── Animations/

│   │   │   ├── VFX/

│   │   │   └── Lighting/

│   │   │

│   │   ├── Audio/

│   │   │   ├── Music/

│   │   │   ├── SFX/

│   │   │   ├── Mixers/

│   │   │   └── Profiles/

│   │   │

│   │   ├── Content/

│   │   │   │

│   │   │   ├── Tops/

│   │   │   │   ├── Definitions/

│   │   │   │   ├── Parts/

│   │   │   │   ├── Assemblies/

│   │   │   │   └── Cosmetics/

│   │   │   │

│   │   │   ├── Elements/

│   │   │   ├── Abilities/

│   │   │   ├── Arenas/

│   │   │   ├── Opponents/

│   │   │   ├── Progression/

│   │   │   └── Rewards/

│   │   │

│   │   ├── Prefabs/

│   │   │   ├── Tops/

│   │   │   ├── Parts/

│   │   │   ├── Arenas/

│   │   │   ├── Effects/

│   │   │   ├── UI/

│   │   │   └── Cameras/

│   │   │

│   │   ├── Scenes/

│   │   │   ├── Bootstrap.unity

│   │   │   ├── MainMenu.unity

│   │   │   ├── Workshop.unity

│   │   │   ├── Battle.unity

│   │   │   └── WebPrototype.unity

│   │   │

│   │   ├── Scripts/

│   │   │   │

│   │   │   ├── Core/

│   │   │   │   ├── Bootstrap/

│   │   │   │   ├── Configuration/

│   │   │   │   ├── Events/

│   │   │   │   ├── Time/

│   │   │   │   ├── Utilities/

│   │   │   │   └── Validation/

│   │   │   │

│   │   │   ├── Domain/

│   │   │   │   ├── Tops/

│   │   │   │   ├── Components/

│   │   │   │   ├── Attributes/

│   │   │   │   ├── Elements/

│   │   │   │   ├── Abilities/

│   │   │   │   ├── Combat/

│   │   │   │   ├── Progression/

│   │   │   │   └── Economy/

│   │   │   │

│   │   │   ├── Simulation/

│   │   │   │   ├── Physics/

│   │   │   │   ├── Rotation/

│   │   │   │   ├── Movement/

│   │   │   │   ├── Collision/

│   │   │   │   ├── Stability/

│   │   │   │   ├── Energy/

│   │   │   │   └── Environment/

│   │   │   │

│   │   │   ├── Combat/

│   │   │   │   ├── Runtime/

│   │   │   │   ├── StateMachine/

│   │   │   │   ├── BattleModes/

│   │   │   │   ├── TacticalCommands/

│   │   │   │   ├── Abilities/

│   │   │   │   ├── Victory/

│   │   │   │   └── Rewards/

│   │   │   │

│   │   │   ├── AI/

│   │   │   │   ├── Decision/

│   │   │   │   ├── Behaviors/

│   │   │   │   └── Profiles/

│   │   │   │

│   │   │   ├── Presentation/

│   │   │   │   ├── Camera/

│   │   │   │   ├── Animation/

│   │   │   │   ├── VFX/

│   │   │   │   ├── Audio/

│   │   │   │   └── UI/

│   │   │   │

│   │   │   ├── Application/

│   │   │   │   ├── Services/

│   │   │   │   ├── Commands/

│   │   │   │   ├── Queries/

│   │   │   │   └── Factories/

│   │   │   │

│   │   │   ├── Infrastructure/

│   │   │   │   ├── Persistence/

│   │   │   │   ├── Assets/

│   │   │   │   ├── Audio/

│   │   │   │   └── Diagnostics/

│   │   │   │

│   │   │   ├── Platform/

│   │   │   │   ├── Abstractions/

│   │   │   │   ├── Web/

│   │   │   │   ├── Desktop/

│   │   │   │   └── Android/

│   │   │   │

│   │   │   └── Input/

│   │   │       ├── Actions/

│   │   │       ├── Desktop/

│   │   │       └── Touch/

│   │   │

│   │   ├── Settings/

│   │   │   ├── Input/

│   │   │   ├── URP/

│   │   │   ├── Addressables/

│   │   │   └── Quality/

│   │   │

│   │   ├── Tests/

│   │   │   ├── EditMode/

│   │   │   ├── PlayMode/

│   │   │   ├── Physics/

│   │   │   ├── Combat/

│   │   │   ├── Persistence/

│   │   │   └── Web/

│   │   │

│   │   └── StreamingAssets/

│   │

│   ├── TextMesh Pro/

│   └── Plugins/

│

├── Build/

│   ├── Web/

│   ├── Windows/

│   └── Android/

│

├── Tools/

│   ├── Build/

│   ├── Validation/

│   └── Development/

│

└── Documentation/

&#x20;   ├── Architecture/

&#x20;   ├── DataContracts/

&#x20;   ├── Decisions/

&#x20;   └── Testing/

```



\## 3.1 Assembly Definitions



Use Assembly Definition files to establish module boundaries.



Recommended assemblies:



| Assembly | Responsibility |

|---|---|

| SpinLegends.Core | Shared primitives and utilities |

| SpinLegends.Domain | Gameplay data and rules |

| SpinLegends.Simulation | Physics and rotational simulation |

| SpinLegends.Combat | Battle orchestration |

| SpinLegends.AI | Opponent decision logic |

| SpinLegends.Application | Use cases and application services |

| SpinLegends.Presentation | UI, camera, VFX and audio |

| SpinLegends.Infrastructure | Storage and asset loading |

| SpinLegends.Platform | Platform adapters |

| SpinLegends.Tests | Automated tests |



\### Dependency Rules



Allowed dependency direction:



```text

Presentation ───────┐

AI ─────────────────┤

Simulation ─────────┤

&#x20;                   ▼

&#x20;              Application

&#x20;                   │

&#x20;                   ▼

&#x20;                 Domain



Infrastructure ─── Application Interfaces

Platform ───────── Application Interfaces

```



Additional constraints:



\- Domain must not reference UnityEngine.

\- Domain must not reference Presentation.

\- Simulation may use Unity physics APIs but must expose platform-independent gameplay results.

\- Presentation must not directly modify domain state.

\- Platform adapters must implement interfaces defined in Core or Application.

\- Infrastructure must not own gameplay rules.

\- UI must send commands through application services.

\- ScriptableObjects must be converted into validated runtime definitions.



Circular assembly dependencies are prohibited.



\---



\# 4. RUNTIME ARCHITECTURE



\## 4.1 Application Bootstrap



`Bootstrap.unity` is the only entry point for application initialization.



Responsibilities:



1\. Initialize configuration.

2\. Initialize platform services.

3\. Initialize asset services.

4\. Initialize persistent storage.

5\. Load application content.

6\. Validate required definitions.

7\. Initialize application state.

8\. Navigate to the main menu.



The bootstrap process must not depend on the active scene being the Battle scene.



\## 4.2 Core Runtime Services



Initial service contracts:



| Service | Responsibility |

|---|---|

| GameApplication | Application lifecycle |

| ContentCatalog | Content definition access |

| TopFactory | Runtime top creation |

| AssemblyService | Component configuration |

| AttributeCalculator | Final attribute calculation |

| BattleCoordinator | Battle lifecycle |

| CombatCommandService | Tactical command execution |

| AbilityService | Ability activation and cooldowns |

| SaveService | Persistence |

| InputService | Logical input routing |

| AudioService | Audio control |

| CameraService | Camera control |

| PlatformService | Platform capabilities |

| DiagnosticsService | Performance and error reporting |



Services must have explicit ownership and initialization order.



Avoid creating a global static service locator as the primary dependency mechanism.



Use constructor injection where practical and controlled composition during Unity bootstrap.



MonoBehaviour components should act as adapters to the underlying application and simulation logic rather than containing the entire gameplay implementation.



\## 4.3 Runtime Top Object



Each active top consists of:



```text

TopRoot

│

├── Rigidbody

├── ColliderRoot

│

├── PhysicsController

├── RotationController

├── MovementController

├── StabilityController

├── EnergyController

│

├── VisualRoot

│   ├── SpiritCore

│   ├── AttackBlade

│   ├── ArmorRing

│   ├── WeightDisc

│   ├── PerformanceDriver

│   └── EnergyModule

│

├── VFXRoot

│

└── AudioRoot

```



The exact hierarchy may vary depending on the mechanical design, but gameplay and visual responsibilities must remain separated.



\## 4.4 Battle Scene Hierarchy



```text

BattleScene

│

├── BattleBootstrap

│

├── BattleEnvironment

│   ├── ArenaGeometry

│   ├── ArenaFloor

│   ├── ArenaBoundaries

│   ├── SpawnPoints

│   └── EnvironmentEffects

│

├── BattleRuntime

│   ├── BattleCoordinator

│   ├── BattleStateMachine

│   ├── BattleClock

│   ├── VictoryEvaluator

│   └── RewardEvaluator

│

├── SimulationRuntime

│   ├── SimulationClock

│   ├── PhysicsWorld

│   └── SimulationDiagnostics

│

├── TopEntities

│   ├── PlayerTop

│   └── OpponentTop

│

├── CameraRig

│

├── AudioRuntime

│

├── VFXRuntime

│

└── UI

&#x20;   ├── BattleHUD

&#x20;   ├── BattleModeSelector

&#x20;   ├── TacticalCommandPanel

&#x20;   ├── AbilityPanel

&#x20;   ├── PausePanel

&#x20;   └── BattleResultPanel

```



\---



\# 5. PHYSICS AND ROTATIONAL SIMULATION



This is the most technically important gameplay subsystem.



A spinning top is not simply a rotating mesh.



The simulation must represent the relationship between rotation, contact, friction, mass distribution, collisions, and energy loss.



\## 5.1 Physical State



Each top must maintain at least:



\- Position.

\- Linear velocity.

\- Linear acceleration.

\- Angular velocity.

\- Angular momentum.

\- Rotational energy.

\- Remaining stamina.

\- Stability.

\- Contact state.

\- Current movement intent.

\- Current simulation state.



The simulation must distinguish between visual spin speed and actual angular velocity.



\## 5.2 Initial Physical Model



The first prototype should use:



\- Rigidbody for translational movement and collision response.

\- Custom rotational state for controlled spin behavior.

\- Explicit rotational energy calculations.

\- Ground contact detection.

\- Simplified gyroscopic stability calculations.

\- Controlled friction and rotational damping.



For the initial prototype, the top can be approximated as an axisymmetric rigid body.



A simplified rotational inertia model:



\\\[

I \\approx \\frac{1}{2}mr^2

\\]



Where:



\- \\(I\\) is rotational inertia.

\- \\(m\\) is effective rotating mass.

\- \\(r\\) is effective rotational radius.



Angular momentum:



\\\[

L = I\\omega

\\]



Rotational energy:



\\\[

E\_r = \\frac{1}{2}I\\omega^2

\\]



These equations provide the initial approximation. Real component geometry can later provide a more accurate inertia estimate.



\## 5.3 Rotation Simulation



The rotational controller must:



1\. Initialize angular velocity.

2\. Apply rotational damping.

3\. Calculate energy loss.

4\. Update angular momentum.

5\. Estimate stability.

6\. Update the visual rotation.

7\. Publish rotational state changes.



The visual model must follow the simulation state rather than independently determining it.



\## 5.4 Ground Contact



Ground interaction must account for:



\- Contact point.

\- Surface normal.

\- Friction coefficient.

\- Sliding velocity.

\- Contact stability.

\- Energy loss.



The initial prototype must use a simplified contact model.



Do not attempt a complete high-fidelity mechanical contact solver before measuring the basic prototype.



\## 5.5 Collision System



The initial collision model must support:



\- Top-to-wall collision.

\- Top-to-floor interaction.

\- Top-to-top collision in the next prototype stage.

\- Collision impulse.

\- Energy loss.

\- Angular velocity disturbance.

\- Collision event generation.



Collision geometry should use simple colliders rather than detailed mesh colliders whenever possible.



\## 5.6 Simulation Quality



Simulation quality must be independent of visual quality.



Reducing particle effects or texture resolution must not change:



\- Collision results.

\- Rotational damping.

\- Movement behavior.

\- Stamina consumption.

\- Victory conditions.



\## 5.7 Simulation Diagnostics



Expose development diagnostics:



\- Current angular velocity.

\- Current linear velocity.

\- Angular momentum.

\- Rotational energy.

\- Stability value.

\- Contact state.

\- Collision count.

\- Simulation step duration.

\- Physics step backlog.



Diagnostics must be removable or disabled in production builds.



\---



\# 6. DATA CONTRACTS



Data definitions must be explicit, validated, versioned, and independent from individual scene instances.



Use ScriptableObjects for static game content and serializable runtime models for player-owned state.



Do not store mutable player progression directly inside shared ScriptableObject assets.



\## 6.1 Naming and Identity



All content definitions must use stable string IDs.



Examples:



\- `top.starter.alpha`

\- `part.blade.standard.001`

\- `element.fire`

\- `ability.fire.burst`

\- `arena.neon.stadium`

\- `opponent.training.basic`



IDs must never depend on display names or Unity instance IDs.



Changing an asset filename must not change its content identity.



\## 6.2 TopDefinition



Represents the base definition of a top.



```csharp

using UnityEngine;



namespace SpinLegends.Domain.Tops

{

&#x20;   \[CreateAssetMenu(

&#x20;       menuName = "Spin Legends/Tops/Top Definition",

&#x20;       fileName = "TopDefinition")]

&#x20;   public sealed class TopDefinition : ScriptableObject

&#x20;   {

&#x20;       public string Id;

&#x20;       public string DisplayName;

&#x20;       public string Description;



&#x20;       public TopArchetype Archetype;

&#x20;       public ElementDefinition PrimaryElement;



&#x20;       public GameObject VisualPrefab;



&#x20;       public TopBaseAttributes BaseAttributes;



&#x20;       public int RequiredPlayerLevel;

&#x20;       public string\[] AllowedPartCategories;

&#x20;   }

}

```



\## 6.3 TopArchetype



```csharp

namespace SpinLegends.Domain.Tops

{

&#x20;   public enum TopArchetype

&#x20;   {

&#x20;       Attacker,

&#x20;       Defender,

&#x20;       Balance,

&#x20;       Stamina

&#x20;   }

}

```



Archetypes define behavioral tendencies and attribute distribution.



They must not create hard equipment restrictions.



\## 6.4 TopBaseAttributes



```csharp

using System;

using UnityEngine;



namespace SpinLegends.Domain.Tops

{

&#x20;   \[Serializable]

&#x20;   public sealed class TopBaseAttributes

&#x20;   {

&#x20;       \[Min(0f)] public float Attack;

&#x20;       \[Min(0f)] public float Defense;

&#x20;       \[Min(0f)] public float Stamina;

&#x20;       \[Min(0f)] public float Speed;

&#x20;       \[Min(0f)] public float Weight;

&#x20;       \[Min(0f)] public float Stability;

&#x20;       \[Min(0f)] public float Control;

&#x20;       \[Min(0f)] public float Energy;

&#x20;       \[Min(0f)] public float Critical;

&#x20;   }

}

```



These are gameplay attributes, not direct physical simulation constants.



The physics system must derive effective mass, inertia, friction, and related parameters from component definitions.



\## 6.5 ComponentDefinition



All physical components share a common definition.



```csharp

using UnityEngine;



namespace SpinLegends.Domain.Components

{

&#x20;   public abstract class ComponentDefinition : ScriptableObject

&#x20;   {

&#x20;       public string Id;

&#x20;       public string DisplayName;

&#x20;       public string Description;



&#x20;       public ComponentCategory Category;



&#x20;       public GameObject VisualPrefab;



&#x20;       public float Mass;

&#x20;       public float RotationalContribution;

&#x20;       public float Durability;



&#x20;       public ComponentAttributeModifiers Modifiers;

&#x20;   }

}

```



\## 6.6 ComponentCategory



```csharp

namespace SpinLegends.Domain.Components

{

&#x20;   public enum ComponentCategory

&#x20;   {

&#x20;       SpiritCore,

&#x20;       AttackBlade,

&#x20;       ArmorRing,

&#x20;       WeightDisc,

&#x20;       PerformanceDriver,

&#x20;       EnergyModule

&#x20;   }

}

```



\## 6.7 ComponentAttributeModifiers



```csharp

using System;

using UnityEngine;



namespace SpinLegends.Domain.Components

{

&#x20;   \[Serializable]

&#x20;   public sealed class ComponentAttributeModifiers

&#x20;   {

&#x20;       public float Attack;

&#x20;       public float Defense;

&#x20;       public float Stamina;

&#x20;       public float Speed;

&#x20;       public float Weight;

&#x20;       public float Stability;

&#x20;       public float Control;

&#x20;       public float Energy;

&#x20;       public float Critical;

&#x20;   }

}

```



\## 6.8 Specialized Components



Create specialized ScriptableObject definitions where physical behavior differs.



Examples:



\- SpiritCoreDefinition

\- AttackBladeDefinition

\- ArmorRingDefinition

\- WeightDiscDefinition

\- PerformanceDriverDefinition

\- EnergyModuleDefinition



The common base contract should contain shared information.



Specialized definitions should contain only category-specific behavior.



\## 6.9 ElementDefinition



```csharp

using UnityEngine;



namespace SpinLegends.Domain.Elements

{

&#x20;   \[CreateAssetMenu(

&#x20;       menuName = "Spin Legends/Elements/Element",

&#x20;       fileName = "Element")]

&#x20;   public sealed class ElementDefinition : ScriptableObject

&#x20;   {

&#x20;       public string Id;

&#x20;       public string DisplayName;



&#x20;       public Color PrimaryColor;

&#x20;       public Color SecondaryColor;



&#x20;       public float AttackModifier;

&#x20;       public float DefenseModifier;



&#x20;       public string PassiveAbilityId;

&#x20;       public string ActiveAbilityId;

&#x20;       public string UltimateAbilityId;

&#x20;   }

}

```



Element interactions must be configured through a separate validated interaction table.



They must not be implemented as scattered hardcoded conditionals.



\## 6.10 AbilityDefinition



```csharp

using UnityEngine;



namespace SpinLegends.Domain.Abilities

{

&#x20;   \[CreateAssetMenu(

&#x20;       menuName = "Spin Legends/Abilities/Ability",

&#x20;       fileName = "Ability")]

&#x20;   public sealed class AbilityDefinition : ScriptableObject

&#x20;   {

&#x20;       public string Id;

&#x20;       public string DisplayName;

&#x20;       public string Description;



&#x20;       public AbilityType Type;



&#x20;       public float EnergyCost;

&#x20;       public float CooldownSeconds;

&#x20;       public float DurationSeconds;



&#x20;       public float Power;

&#x20;       public float Range;



&#x20;       public GameObject EffectPrefab;

&#x20;   }

}

```



```csharp

namespace SpinLegends.Domain.Abilities

{

&#x20;   public enum AbilityType

&#x20;   {

&#x20;       Elemental,

&#x20;       Defensive,

&#x20;       Tactical,

&#x20;       Ultimate

&#x20;   }

}

```



Ability definitions must not contain references to specific battle instances.



\## 6.11 ArenaDefinition



```csharp

using UnityEngine;



namespace SpinLegends.Domain.Arenas

{

&#x20;   \[CreateAssetMenu(

&#x20;       menuName = "Spin Legends/Arenas/Arena",

&#x20;       fileName = "Arena")]

&#x20;   public sealed class ArenaDefinition : ScriptableObject

&#x20;   {

&#x20;       public string Id;

&#x20;       public string DisplayName;



&#x20;       public GameObject ArenaPrefab;



&#x20;       public float GroundFriction;

&#x20;       public float BoundaryRestitution;



&#x20;       public Vector3 PlayerSpawnPosition;

&#x20;       public Vector3 OpponentSpawnPosition;



&#x20;       public float ArenaRadius;



&#x20;       public bool EnableEnvironmentalEffects;

&#x20;   }

}

```



Arena geometry and environmental behavior must be configured separately from combat rules.



\## 6.12 OpponentDefinition



```csharp

using UnityEngine;



namespace SpinLegends.AI

{

&#x20;   \[CreateAssetMenu(

&#x20;       menuName = "Spin Legends/AI/Opponent",

&#x20;       fileName = "Opponent")]

&#x20;   public sealed class OpponentDefinition : ScriptableObject

&#x20;   {

&#x20;       public string Id;

&#x20;       public string DisplayName;



&#x20;       public TopDefinition Top;

&#x20;       public OpponentPersonality Personality;



&#x20;       public int DifficultyLevel;



&#x20;       public float Aggression;

&#x20;       public float DefensePreference;

&#x20;       public float AbilityUsagePreference;

&#x20;       public float RiskTolerance;

&#x20;   }

}

```



Opponent decisions must depend on runtime battle conditions, not only fixed personality values.



\## 6.13 RuntimeTopState



Represents one owned top instance.



```csharp

using System;

using System.Collections.Generic;



namespace SpinLegends.Domain.Tops

{

&#x20;   \[Serializable]

&#x20;   public sealed class RuntimeTopState

&#x20;   {

&#x20;       public string InstanceId;

&#x20;       public string DefinitionId;



&#x20;       public int Level;

&#x20;       public long Experience;



&#x20;       public int EvolutionStage;



&#x20;       public Dictionary<string, string> EquippedComponents;



&#x20;       public List<string> UnlockedAbilities;



&#x20;       public string CosmeticId;



&#x20;       public long CreatedAtUnixMs;

&#x20;   }

}

```



`InstanceId` must be unique for every owned top.



`DefinitionId` identifies the static base definition.



Equipped component entries map category IDs to component instance IDs or definition IDs according to the inventory model.



The implementation must choose one ownership model and apply it consistently.



\## 6.14 BattleRuntimeState



```csharp

using System;



namespace SpinLegends.Domain.Combat

{

&#x20;   \[Serializable]

&#x20;   public sealed class BattleRuntimeState

&#x20;   {

&#x20;       public string BattleId;



&#x20;       public string PlayerTopInstanceId;

&#x20;       public string OpponentId;



&#x20;       public string ArenaId;



&#x20;       public BattlePhase Phase;



&#x20;       public float ElapsedTime;



&#x20;       public float PlayerStamina;

&#x20;       public float OpponentStamina;



&#x20;       public float PlayerEnergy;

&#x20;       public float OpponentEnergy;



&#x20;       public float PlayerResonance;

&#x20;       public float OpponentResonance;



&#x20;       public string PlayerBattleMode;

&#x20;       public string OpponentBattleMode;

&#x20;   }

}

```



High-frequency physical values must remain in simulation runtime structures.



Do not serialize the entire physical simulation every frame.



\## 6.15 PlayerSaveData



```csharp

using System;

using System.Collections.Generic;



namespace SpinLegends.Infrastructure.Persistence

{

&#x20;   \[Serializable]

&#x20;   public sealed class PlayerSaveData

&#x20;   {

&#x20;       public int SchemaVersion;



&#x20;       public string PlayerId;



&#x20;       public long CreatedAtUnixMs;

&#x20;       public long UpdatedAtUnixMs;



&#x20;       public int PlayerLevel;

&#x20;       public long PlayerExperience;



&#x20;       public long Gold;



&#x20;       public List<string> UnlockedContentIds;



&#x20;       public List<OwnedTopSaveData> OwnedTops;



&#x20;       public List<InventoryItemSaveData> Inventory;



&#x20;       public string SelectedTopInstanceId;



&#x20;       public string SettingsJson;

&#x20;   }

}

```



\## 6.16 OwnedTopSaveData



```csharp

using System;

using System.Collections.Generic;



namespace SpinLegends.Infrastructure.Persistence

{

&#x20;   \[Serializable]

&#x20;   public sealed class OwnedTopSaveData

&#x20;   {

&#x20;       public string InstanceId;

&#x20;       public string DefinitionId;



&#x20;       public int Level;

&#x20;       public long Experience;



&#x20;       public int EvolutionStage;



&#x20;       public List<EquippedComponentSaveData> Components;



&#x20;       public List<string> UnlockedAbilities;



&#x20;       public string CosmeticId;

&#x20;   }

}

```



\## 6.17 InventoryItemSaveData



```csharp

using System;



namespace SpinLegends.Infrastructure.Persistence

{

&#x20;   \[Serializable]

&#x20;   public sealed class InventoryItemSaveData

&#x20;   {

&#x20;       public string ItemId;

&#x20;       public string ItemType;



&#x20;       public int Quantity;

&#x20;   }

}

```



\## 6.18 EquippedComponentSaveData



```csharp

using System;



namespace SpinLegends.Infrastructure.Persistence

{

&#x20;   \[Serializable]

&#x20;   public sealed class EquippedComponentSaveData

&#x20;   {

&#x20;       public string Category;

&#x20;       public string ComponentId;

&#x20;   }

}

```



\## 6.19 Save Schema Rules



The save system must enforce:



\- Schema versioning.

\- Stable content IDs.

\- Validation of referenced definitions.

\- Safe migration.

\- Corruption detection.

\- Recovery from interrupted writes.

\- Duplicate reward prevention.



A save migration must never silently discard valid player progression.



\## 6.20 Data Validation



All content definitions must be validated before entering gameplay.



Validation examples:



\- Missing IDs.

\- Duplicate IDs.

\- Missing prefabs.

\- Negative mass.

\- Invalid cooldowns.

\- Missing element references.

\- Invalid ability references.

\- Invalid arena dimensions.

\- Missing component categories.

\- Unsupported content references.



Create an Editor validation tool that scans all registered definitions and reports errors before building.



\---



\# 7. PLATFORM ABSTRACTIONS



The gameplay core must not directly access browser APIs or operating-system-specific functionality.



\## 7.1 Storage Contract



```csharp

using System.Threading.Tasks;



namespace SpinLegends.Application.Services

{

&#x20;   public interface IStorageService

&#x20;   {

&#x20;       Task<bool> ExistsAsync(string key);



&#x20;       Task<byte\[]> ReadAsync(string key);



&#x20;       Task WriteAsync(string key, byte\[] data);



&#x20;       Task DeleteAsync(string key);

&#x20;   }

}

```



Implementations:



\- WebStorageService

\- DesktopStorageService

\- AndroidStorageService



Web storage must use an IndexedDB-backed implementation.



The WebGL implementation must respect Unity's threading and JavaScript interoperability limitations.



\## 7.2 Platform Contract



```csharp

namespace SpinLegends.Application.Services

{

&#x20;   public interface IPlatformService

&#x20;   {

&#x20;       bool IsMobile { get; }



&#x20;       bool SupportsFullscreen { get; }



&#x20;       bool SupportsGamepad { get; }



&#x20;       void RequestFullscreen();



&#x20;       void ExitFullscreen();

&#x20;   }

}

```



Browser capability detection must be implemented in the Web adapter.



\## 7.3 Input Contract



```csharp

using UnityEngine;



namespace SpinLegends.Application.Services

{

&#x20;   public interface IInputService

&#x20;   {

&#x20;       Vector2 GetMovementInput();



&#x20;       bool ConsumeAbilityPressed();



&#x20;       bool ConsumePausePressed();



&#x20;       bool ConsumeCommandPressed(out int commandIndex);

&#x20;   }

}

```



The actual input action system must be centralized.



UI components must not independently read raw input devices.



\## 7.4 Browser Lifecycle Contract



```csharp

namespace SpinLegends.Application.Services

{

&#x20;   public interface IApplicationLifecycleService

&#x20;   {

&#x20;       bool IsApplicationVisible { get; }



&#x20;       void PauseApplication();



&#x20;       void ResumeApplication();

&#x20;   }

}

```



The web implementation must respond to browser visibility and focus changes.



\---



\# 8. PHYSICS IMPLEMENTATION CONTRACTS



\## 8.1 Simulation Parameters



Create a dedicated configuration asset:



`SpinSimulationConfig.asset`



Initial parameters:



| Parameter | Initial Value |

|---|---:|

| Fixed Timestep | 0.02 s |

| Maximum Catch-up Steps | 3 |

| Initial Angular Velocity | 100 rad/s |

| Rotational Damping | Prototype-calibrated |

| Ground Friction | Arena-dependent |

| Stability Threshold | Prototype-calibrated |

| Energy Depletion Threshold | Prototype-calibrated |

| Collision Impulse Scale | Prototype-calibrated |



These values are starting parameters, not final gameplay balance values.



\## 8.2 Simulation State



The internal simulation state must contain:



```csharp

using UnityEngine;



namespace SpinLegends.Simulation

{

&#x20;   public struct TopSimulationState

&#x20;   {

&#x20;       public Vector3 Position;



&#x20;       public Vector3 LinearVelocity;



&#x20;       public Vector3 AngularVelocity;



&#x20;       public Vector3 AngularMomentum;



&#x20;       public float RotationalEnergy;



&#x20;       public float Stability;



&#x20;       public float RemainingStamina;



&#x20;       public bool IsGrounded;

&#x20;   }

}

```



\## 8.3 Simulation Update



The simulation update pipeline:



```text

Fixed Simulation Step

&#x20;       │

&#x20;       ▼

Read Current State

&#x20;       │

&#x20;       ▼

Apply Movement Intent

&#x20;       │

&#x20;       ▼

Apply Translational Forces

&#x20;       │

&#x20;       ▼

Resolve Physics Contacts

&#x20;       │

&#x20;       ▼

Update Rotational State

&#x20;       │

&#x20;       ▼

Calculate Energy Loss

&#x20;       │

&#x20;       ▼

Calculate Stability

&#x20;       │

&#x20;       ▼

Update Stamina

&#x20;       │

&#x20;       ▼

Publish Simulation Events

```



The order must be consistent and documented.



The implementation must carefully define whether Unity physics integration occurs before or after custom rotational updates.



\## 8.4 Visual Synchronization



The visual model must interpolate between simulation states.



The rendering update must not directly modify authoritative physical values.



\## 8.5 Physical Calibration



The prototype must expose adjustable parameters through configuration assets.



No important physical constant should be buried inside multiple MonoBehaviour scripts.



\---



\# 9. FIRST IMPLEMENTATION: WEB FEASIBILITY PROTOTYPE



\## 9.1 Objective



The first deliverable is not a complete game.



It is a technical prototype that proves whether the selected engine and rendering configuration can deliver the required spinning-top experience inside modern browsers.



The prototype must contain:



1\. One 3D spinning top.

2\. Actual rotational simulation.

3\. Linear movement.

4\. Arena floor.

5\. Arena wall collisions.

6\. Camera tracking.

7\. Mouse and keyboard input.

8\. Touch input.

9\. Browser lifecycle handling.

10\. Performance diagnostics.



No progression, inventory, abilities, or complete battle system is required.



\## 9.2 Prototype Scene



Scene:



`WebPrototype.unity`



Hierarchy:



```text

WebPrototype

│

├── PrototypeBootstrap

│

├── Arena

│   ├── Floor

│   ├── OuterWall

│   ├── InnerBoundary

│   └── Lighting

│

├── PlayerTop

│   ├── Rigidbody

│   ├── Collider

│   ├── RotationController

│   ├── MovementController

│   └── VisualRoot

│

├── CameraRig

│   ├── CameraTarget

│   └── MainCamera

│

├── Input

│   ├── DesktopInput

│   └── TouchInput

│

└── Diagnostics

&#x20;   ├── PerformanceMonitor

&#x20;   └── SimulationOverlay

```



\## 9.3 Prototype Controls



Desktop:



\- WASD: Movement direction.

\- Mouse: Camera rotation.

\- Mouse wheel: Zoom.

\- Space: Pause or resume.

\- R: Reset prototype.



Mobile:



\- Left virtual joystick: Movement direction.

\- Right-side drag: Camera rotation.

\- Pinch: Zoom.

\- On-screen pause button.

\- Reset button.



Movement input controls intent, not direct transform positioning.



The top must still interact with the physics system.



\## 9.4 Camera Behavior



The camera must:



\- Follow the top smoothly.

\- Maintain a useful arena overview.

\- Avoid abrupt position changes.

\- Support desktop mouse input.

\- Support mobile touch input.

\- Prevent excessive zoom.

\- Avoid clipping through arena geometry.



The first prototype does not require cinematic camera behavior.



\## 9.5 Browser Test Matrix



Minimum validation matrix:



| Environment | Test |

|---|---|

| Chrome Desktop | Initialization and gameplay |

| Chrome Desktop | Physics and collision |

| Chrome Desktop | Camera and mouse |

| Chrome Android | Touch input |

| Chrome Android | Rendering performance |

| Chrome Android | Memory behavior |

| Chrome Android | Browser suspension |

| Firefox Desktop | Basic compatibility |

| Edge Desktop | Basic compatibility |



Safari validation should be included before claiming broad browser compatibility.



\## 9.6 Performance Measurements



Capture:



\- Average FPS.

\- 1% low FPS where available.

\- Main-thread frame time.

\- Physics simulation time.

\- GPU frame time where available.

\- Initial download size.

\- Time to first playable frame.

\- Peak memory where measurable.

\- WebGL context loss.

\- Input response latency.



Use browser developer tools and Unity profiling tools where available.



Measurements must identify the exact browser, browser version, device, GPU, resolution, build configuration, and test scenario.



\## 9.7 Prototype Acceptance Criteria



The prototype passes when:



1\. The web build launches successfully.

2\. The top rotates continuously through actual simulation state.

3\. Angular velocity affects visual rotation.

4\. Translational movement is physics-driven.

5\. The top collides with arena walls.

6\. Collision response is stable.

7\. Camera tracking works.

8\. Desktop controls work.

9\. Android touch controls work.

10\. Browser tab suspension is handled.

11\. No persistent physics instability occurs.

12\. The build can be profiled on target browsers.

13\. Performance and memory measurements are documented.



\## 9.8 Prototype Exit Decision



After completing the prototype, make one of three decisions:



\*\*PASS\*\*



The chosen Unity Web configuration is suitable for continuing development.



\*\*CONDITIONAL PASS\*\*



The architecture is viable, but specific optimizations or hardware constraints must be addressed.



\*\*FAIL\*\*



The selected configuration cannot meet the required gameplay or performance targets.



A failed prototype must trigger a technical review before additional game systems are implemented.



Do not proceed to large-scale content production while the feasibility question remains unresolved.



\---



\# 10. FIRST VERTICAL SLICE



\## 10.1 Objective



The first Vertical Slice must demonstrate one complete and polished gameplay experience.



It must connect the major systems into one playable sequence:



```text

Launch Game

&#x20;   │

&#x20;   ▼

Main Menu

&#x20;   │

&#x20;   ▼

Select Top

&#x20;   │

&#x20;   ▼

Select Arena

&#x20;   │

&#x20;   ▼

Start Battle

&#x20;   │

&#x20;   ▼

Launch Phase

&#x20;   │

&#x20;   ▼

Physics-Driven Combat

&#x20;   │

&#x20;   ▼

Tactical Interaction

&#x20;   │

&#x20;   ▼

Victory Evaluation

&#x20;   │

&#x20;   ▼

Battle Results

&#x20;   │

&#x20;   ▼

Reward Processing

&#x20;   │

&#x20;   ▼

Save Progress

&#x20;   │

&#x20;   ▼

Return to Menu

```



The Vertical Slice is not a content-complete release.



It proves that the architecture, gameplay loop, presentation, and persistence work together.



\## 10.2 Vertical Slice Content



Initial content target:



| Content | Quantity |

|---|---:|

| Arena | 1 |

| Playable Tops | 2 |

| Opponent Profiles | 1 |

| Component Categories | 6 |

| Components | 12 |

| Elements | 2 |

| Battle Modes | 3 |

| Tactical Commands | 4 |

| Active Abilities | 2 |

| Game Modes | 1 |

| Battle HUD | 1 |

| Victory Conditions | 3 |



The reduced content target is intentional.



It allows the team to validate the full system without producing the entire MVP content catalog.



\## 10.3 Vertical Slice Game Mode



Use one Training Battle scenario.



The player fights one AI opponent in one arena.



The scenario must support:



\- Battle preparation.

\- Launch.

\- Combat.

\- Tactical commands.

\- Battle Mode changes.

\- Ability activation.

\- Victory detection.

\- Results.

\- Reward application.



Tournament progression is not required for this first slice.



\## 10.4 Vertical Slice Battle Modes



Initial modes:



\- Attack

\- Defense

\- Stamina



Each mode must produce a meaningful behavioral difference.



The difference must affect simulation intent or decision-making rather than merely changing UI labels.



\## 10.5 Vertical Slice Tactical Commands



Initial commands:



\- Aggressive

\- Defensive

\- Chase

\- Evade



Commands must affect AI or player-controlled movement intent.



The player must be able to combine a Battle Mode and a Tactical Command.



Example:



`Attack Mode + Evade Command`



The system must define tactical commitment duration and command switching rules.



\## 10.6 Vertical Slice Abilities



Implement two abilities:



\- One offensive ability.

\- One defensive ability.



Each ability must include:



\- Definition.

\- Energy cost.

\- Cooldown.

\- Activation validation.

\- Runtime execution.

\- Visual feedback.

\- Audio feedback.

\- UI state.

\- Failure handling.



\## 10.7 Victory Conditions



Implement at least three conditions:



\- Spin Finish.

\- Ring Out.

\- Survival.



Victory evaluation must be centralized.



The system must not depend on UI code to determine the winner.



\## 10.8 AI Behavior



The initial AI must:



\- Monitor distance.

\- Monitor stamina.

\- Monitor energy.

\- Select tactical commands.

\- Change battle modes.

\- Use abilities when valid.

\- React to critical situations.



The AI must operate through the same command interface used by player input.



\## 10.9 Vertical Slice UI



Required screens:



\- Main Menu.

\- Top Selection.

\- Battle Preparation.

\- Battle HUD.

\- Pause.

\- Battle Results.



Workshop editing can remain minimal.



The player must be able to select between the two predefined playable configurations.



\## 10.10 Vertical Slice Persistence



Persist:



\- Selected top.

\- Player progression.

\- Battle results.

\- Rewards.

\- Basic settings.



The game must recover from a normal page refresh without corrupting the save.



The initial persistence implementation must be tested on the actual WebGL build, not only in the Unity Editor.



\## 10.11 Vertical Slice Acceptance Criteria



The slice passes when:



1\. The game starts from the browser.

2\. The player can enter the Training Battle.

3\. The selected top is instantiated correctly.

4\. The opponent is instantiated correctly.

5\. Physical spinning is active.

6\. Collisions influence combat.

7\. Battle Modes change behavior.

8\. Tactical Commands change behavior.

9\. Abilities activate correctly.

10\. AI decisions are functional.

11\. Victory conditions are evaluated correctly.

12\. Results are displayed.

13\. Rewards are applied exactly once.

14\. Progression is saved.

15\. The player can return to the main menu.

16\. The same battle can be repeated.

17\. The game remains usable on desktop and Android browsers.



\---



\# 11. COMPLETE INITIAL TASK BACKLOG



\## 11.1 Task Management Rules



Every task must have:



\- Unique ID.

\- Title.

\- Description.

\- Priority.

\- Dependencies.

\- Deliverable.

\- Acceptance criteria.



Task dependencies must be respected.



A task must not be marked complete simply because its code exists.



Its acceptance criteria must be verified.



\### Priority Definitions



| Priority | Meaning |

|---|---|

| P0 | Critical blocker |

| P1 | Required for the current milestone |

| P2 | Important supporting work |

| P3 | Deferred improvement |



\### Task Status



Allowed statuses:



\- Backlog

\- Ready

\- In Progress

\- Blocked

\- In Review

\- Testing

\- Done



\### Dependency Notation



`Depends on: None` means the task can start independently.



All other dependency references identify prerequisite task IDs.



\---



\# 12. PROJECT FOUNDATION TASKS



\## EPIC SL-001 — Repository and Unity Foundation



| ID | Task | Priority | Dependencies | Deliverable |

|---|---|---|---|---|

| SL-001 | Create Git repository | P0 | None | Repository |

| SL-002 | Initialize Unity 6 LTS project | P0 | SL-001 | Unity project |

| SL-003 | Configure URP | P0 | SL-002 | Rendering configuration |

| SL-004 | Configure WebGL build target | P0 | SL-002 | Web build configuration |

| SL-005 | Pin Unity package versions | P1 | SL-002 | Package manifest |

| SL-006 | Configure Git ignore rules | P1 | SL-001 | Repository configuration |

| SL-007 | Create project folder structure | P0 | SL-002 | Project hierarchy |

| SL-008 | Create Assembly Definitions | P1 | SL-007 | Module boundaries |

| SL-009 | Configure coding conventions | P2 | SL-002 | Coding standard |

| SL-010 | Create bootstrap scene | P1 | SL-007 | Bootstrap scene |



\## EPIC SL-011 — Development Infrastructure



| ID | Task | Priority | Dependencies | Deliverable |

|---|---|---|---|---|

| SL-011 | Configure Unity Test Framework | P1 | SL-002 | Test environment |

| SL-012 | Configure build profiles | P1 | SL-004 | Build profiles |

| SL-013 | Create development build script | P2 | SL-012 | Build automation |

| SL-014 | Create WebGL deployment template | P2 | SL-004 | Deployment configuration |

| SL-015 | Configure browser diagnostics | P1 | SL-004 | Diagnostics integration |

| SL-016 | Create technical decision log | P2 | SL-001 | Decision records |



\---



\# 13. WEB FEASIBILITY PROTOTYPE TASKS



\## EPIC SL-020 — Prototype Environment



| ID | Task | Priority | Dependencies | Deliverable |

|---|---|---|---|---|

| SL-020 | Create WebPrototype scene | P0 | SL-007 | Prototype scene |

| SL-021 | Create prototype arena floor | P0 | SL-020 | Floor geometry |

| SL-022 | Create arena boundaries | P0 | SL-021 | Collision boundaries |

| SL-023 | Configure prototype lighting | P2 | SL-020 | Lighting setup |

| SL-024 | Create prototype top model | P0 | SL-020 | 3D top asset |

| SL-025 | Configure top Rigidbody and collider | P0 | SL-024 | Physical object |



\## EPIC SL-026 — Rotational Simulation



| ID | Task | Priority | Dependencies | Deliverable |

|---|---|---|---|---|

| SL-026 | Define simulation state | P0 | SL-008 | TopSimulationState |

| SL-027 | Implement fixed simulation clock | P0 | SL-026 | SimulationClock |

| SL-028 | Implement angular velocity state | P0 | SL-026 | Rotation state |

| SL-029 | Implement rotational energy calculation | P0 | SL-028 | Energy model |

| SL-030 | Implement rotational damping | P0 | SL-029 | Spin decay |

| SL-031 | Implement visual rotation synchronization | P0 | SL-028 | Visual rotation |

| SL-032 | Implement ground contact detection | P0 | SL-025 | Contact system |

| SL-033 | Implement basic stability calculation | P1 | SL-028, SL-032 | Stability model |

| SL-034 | Implement stamina depletion | P1 | SL-029, SL-033 | Stamina model |



\## EPIC SL-035 — Movement and Collision



| ID | Task | Priority | Dependencies | Deliverable |

|---|---|---|---|---|

| SL-035 | Implement movement intent model | P0 | SL-026 | MovementIntent |

| SL-036 | Implement translational movement | P0 | SL-025, SL-035 | Movement controller |

| SL-037 | Implement arena wall collision response | P0 | SL-022, SL-025 | Wall collision |

| SL-038 | Implement collision event reporting | P1 | SL-037 | Collision events |

| SL-039 | Implement configurable friction | P1 | SL-032 | Friction model |

| SL-040 | Implement simulation parameter asset | P1 | SL-027 | Simulation configuration |



\## EPIC SL-041 — Camera and Input



| ID | Task | Priority | Dependencies | Deliverable |

|---|---|---|---|---|

| SL-041 | Implement camera follow | P1 | SL-020, SL-024 | Camera controller |

| SL-042 | Implement desktop movement input | P0 | SL-035 | Keyboard input |

| SL-043 | Implement mouse camera controls | P1 | SL-041 | Mouse camera |

| SL-044 | Implement touch joystick | P0 | SL-035 | Touch movement |

| SL-045 | Implement touch camera controls | P1 | SL-041 | Touch camera |

| SL-046 | Implement pause and reset controls | P1 | SL-027 | Prototype controls |



\## EPIC SL-047 — Web Validation



| ID | Task | Priority | Dependencies | Deliverable |

|---|---|---|---|---|

| SL-047 | Implement browser lifecycle adapter | P0 | SL-010, SL-004 | Lifecycle handling |

| SL-048 | Implement performance monitor | P1 | SL-004 | Performance overlay |

| SL-049 | Implement simulation diagnostics | P1 | SL-026 | Simulation overlay |

| SL-050 | Build first WebGL prototype | P0 | SL-020, SL-026, SL-035, SL-041 | Web build |

| SL-051 | Test Chrome desktop | P0 | SL-050 | Test report |

| SL-052 | Test Chrome Android | P0 | SL-050 | Test report |

| SL-053 | Test Firefox and Edge | P2 | SL-050 | Compatibility report |

| SL-054 | Measure memory and startup | P0 | SL-050 | Performance report |

| SL-055 | Review feasibility results | P0 | SL-051, SL-052, SL-054 | Go/no-go decision |



\---



\# 14. CORE ARCHITECTURE TASKS



\## EPIC SL-060 — Domain Layer



| ID | Task | Priority | Dependencies | Deliverable |

|---|---|---|---|---|

| SL-060 | Define content ID conventions | P1 | SL-008 | ID standard |

| SL-061 | Implement top domain models | P1 | SL-060 | Top models |

| SL-062 | Implement component domain models | P1 | SL-060 | Component models |

| SL-063 | Implement attribute models | P1 | SL-061 | Attribute model |

| SL-064 | Implement element domain models | P2 | SL-060 | Element model |

| SL-065 | Implement ability domain models | P1 | SL-060 | Ability model |

| SL-066 | Implement arena domain models | P1 | SL-060 | Arena model |

| SL-067 | Implement opponent domain models | P2 | SL-060 | Opponent model |

| SL-068 | Implement battle domain models | P1 | SL-061 | Battle models |



\## EPIC SL-069 — Content Definitions



| ID | Task | Priority | Dependencies | Deliverable |

|---|---|---|---|---|

| SL-069 | Implement TopDefinition | P1 | SL-061 | ScriptableObject |

| SL-070 | Implement ComponentDefinition | P1 | SL-062 | ScriptableObject |

| SL-071 | Implement specialized component definitions | P2 | SL-070 | Component assets |

| SL-072 | Implement ElementDefinition | P2 | SL-064 | ScriptableObject |

| SL-073 | Implement AbilityDefinition | P1 | SL-065 | ScriptableObject |

| SL-074 | Implement ArenaDefinition | P1 | SL-066 | ScriptableObject |

| SL-075 | Implement OpponentDefinition | P2 | SL-067 | ScriptableObject |

| SL-076 | Implement content catalog | P1 | SL-069, SL-070, SL-073, SL-074 | ContentCatalog |

| SL-077 | Implement content validation tools | P1 | SL-076 | Validation tools |



\## EPIC SL-078 — Application Services



| ID | Task | Priority | Dependencies | Deliverable |

|---|---|---|---|---|

| SL-078 | Implement application bootstrap | P1 | SL-010 | Bootstrap service |

| SL-079 | Implement TopFactory | P1 | SL-069, SL-076 | TopFactory |

| SL-080 | Implement AssemblyService | P1 | SL-070, SL-079 | AssemblyService |

| SL-081 | Implement AttributeCalculator | P1 | SL-063, SL-080 | Attribute calculation |

| SL-082 | Implement dependency composition | P1 | SL-078, SL-079 | Composition root |

| SL-083 | Implement application event system | P2 | SL-008 | Event infrastructure |



\---



\# 15. COMBAT AND GAMEPLAY TASKS



\## EPIC SL-090 — Combat Runtime



| ID | Task | Priority | Dependencies | Deliverable |

|---|---|---|---|---|

| SL-090 | Define battle phases | P1 | SL-068 | BattlePhase |

| SL-091 | Implement battle state machine | P1 | SL-090 | State machine |

| SL-092 | Implement BattleCoordinator | P1 | SL-091, SL-079 | Battle orchestration |

| SL-093 | Implement battle clock | P1 | SL-091 | Battle timer |

| SL-094 | Implement battle preparation | P1 | SL-092 | Preparation phase |

| SL-095 | Implement launch phase | P1 | SL-094, SL-026 | Launch phase |

| SL-096 | Implement combat phase | P1 | SL-095, SL-036 | Combat phase |

| SL-097 | Implement critical phase | P2 | SL-096 | Critical state |

| SL-098 | Implement finish phase | P1 | SL-096 | Finish phase |



\## EPIC SL-099 — Battle Modes and Commands



| ID | Task | Priority | Dependencies | Deliverable |

|---|---|---|---|---|

| SL-099 | Define BattleMode | P1 | SL-090 | BattleMode |

| SL-100 | Implement Attack Mode | P1 | SL-099, SL-035 | Attack behavior |

| SL-101 | Implement Defense Mode | P1 | SL-099, SL-035 | Defense behavior |

| SL-102 | Implement Stamina Mode | P1 | SL-099, SL-034 | Stamina behavior |

| SL-103 | Define TacticalCommand | P1 | SL-090 | Command model |

| SL-104 | Implement Aggressive Command | P1 | SL-103 | Tactical behavior |

| SL-105 | Implement Defensive Command | P1 | SL-103 | Tactical behavior |

| SL-106 | Implement Chase Command | P1 | SL-103 | Tactical behavior |

| SL-107 | Implement Evade Command | P1 | SL-103 | Tactical behavior |

| SL-108 | Implement tactical commitment | P1 | SL-103 | Command duration |

| SL-109 | Implement command validation | P1 | SL-108 | Command validation |



\## EPIC SL-110 — Abilities



| ID | Task | Priority | Dependencies | Deliverable |

|---|---|---|---|---|

| SL-110 | Implement energy management | P1 | SL-034 | Energy system |

| SL-111 | Implement ability validation | P1 | SL-073, SL-110 | Ability validation |

| SL-112 | Implement cooldown management | P1 | SL-073 | Cooldown system |

| SL-113 | Implement offensive ability | P1 | SL-111, SL-112 | Offensive ability |

| SL-114 | Implement defensive ability | P1 | SL-111, SL-112 | Defensive ability |

| SL-115 | Implement ability feedback events | P2 | SL-113, SL-114 | Ability events |



\## EPIC SL-116 — AI



| ID | Task | Priority | Dependencies | Deliverable |

|---|---|---|---|---|

| SL-116 | Implement opponent runtime | P1 | SL-075, SL-092 | Opponent runtime |

| SL-117 | Implement combat observation model | P1 | SL-116, SL-068 | AI observations |

| SL-118 | Implement tactical decision engine | P1 | SL-117, SL-103 | Decision engine |

| SL-119 | Implement battle mode selection | P1 | SL-118, SL-099 | Mode selection |

| SL-120 | Implement ability decision logic | P2 | SL-118, SL-111 | Ability decisions |

| SL-121 | Implement basic AI personality profile | P2 | SL-118 | AI personality |



\## EPIC SL-122 — Victory and Rewards



| ID | Task | Priority | Dependencies | Deliverable |

|---|---|---|---|---|

| SL-122 | Implement victory evaluator | P1 | SL-096 | Victory evaluator |

| SL-123 | Implement Spin Finish | P1 | SL-122, SL-034 | Victory condition |

| SL-124 | Implement Ring Out | P1 | SL-122, SL-037 | Victory condition |

| SL-125 | Implement Survival | P1 | SL-122, SL-034 | Victory condition |

| SL-126 | Implement battle result model | P1 | SL-122 | Battle results |

| SL-127 | Implement reward calculation | P1 | SL-126 | Reward calculation |

| SL-128 | Implement duplicate reward protection | P1 | SL-127 | Reward validation |



\---



\# 16. PERSISTENCE AND WEB PLATFORM TASKS



\## EPIC SL-130 — Persistence



| ID | Task | Priority | Dependencies | Deliverable |

|---|---|---|---|---|

| SL-130 | Define save schema | P1 | SL-061, SL-068 | Save contracts |

| SL-131 | Implement IStorageService | P1 | SL-008 | Storage interface |

| SL-132 | Implement Web IndexedDB adapter | P1 | SL-131, SL-004 | Web storage |

| SL-133 | Implement desktop storage adapter | P2 | SL-131 | Desktop storage |

| SL-134 | Implement Android storage adapter | P2 | SL-131 | Android storage |

| SL-135 | Implement SaveService | P1 | SL-130, SL-131 | Save service |

| SL-136 | Implement schema migration | P1 | SL-135 | Migration service |

| SL-137 | Implement save validation | P1 | SL-135 | Save validation |

| SL-138 | Implement save recovery | P1 | SL-136, SL-137 | Recovery mechanism |

| SL-139 | Test WebGL persistence | P0 | SL-132, SL-135 | Browser persistence tests |



\## EPIC SL-140 — Browser Integration



| ID | Task | Priority | Dependencies | Deliverable |

|---|---|---|---|---|

| SL-140 | Implement browser fullscreen | P2 | SL-004 | Fullscreen integration |

| SL-141 | Implement audio activation | P1 | SL-004 | Audio activation |

| SL-142 | Implement browser visibility events | P1 | SL-047 | Visibility handling |

| SL-143 | Implement WebGL context recovery handling | P1 | SL-004 | Recovery handling |

| SL-144 | Implement responsive viewport handling | P1 | SL-004 | Responsive layout |

| SL-145 | Implement browser error reporting | P2 | SL-015 | Error reporting |



\## EPIC SL-146 — Asset Delivery



| ID | Task | Priority | Dependencies | Deliverable |

|---|---|---|---|---|

| SL-146 | Configure Addressables | P1 | SL-005 | Addressables setup |

| SL-147 | Define initial asset groups | P1 | SL-146 | Asset groups |

| SL-148 | Implement asset loading service | P1 | SL-147 | Asset loading |

| SL-149 | Configure content versioning | P1 | SL-148 | Versioned assets |

| SL-150 | Configure CDN deployment | P2 | SL-149 | CDN configuration |

| SL-151 | Test interrupted asset downloads | P1 | SL-148 | Recovery tests |



\---



\# 17. VERTICAL SLICE TASKS



\## EPIC SL-160 — Battle Scene



| ID | Task | Priority | Dependencies | Deliverable |

|---|---|---|---|---|

| SL-160 | Create Battle scene | P1 | SL-020, SL-092 | Battle scene |

| SL-161 | Create initial arena prefab | P1 | SL-074 | Arena prefab |

| SL-162 | Create first playable top definition | P1 | SL-069, SL-070 | Top content |

| SL-163 | Create second playable top definition | P2 | SL-069, SL-070 | Top content |

| SL-164 | Integrate player top | P1 | SL-160, SL-079 | Player top |

| SL-165 | Integrate opponent top | P1 | SL-160, SL-116 | Opponent top |

| SL-166 | Implement top-to-top collision | P1 | SL-165, SL-038 | Collision behavior |

| SL-167 | Integrate arena configuration | P1 | SL-161, SL-092 | Arena runtime |



\## EPIC SL-168 — Presentation



| ID | Task | Priority | Dependencies | Deliverable |

|---|---|---|---|---|

| SL-168 | Implement battle camera | P1 | SL-160 | Battle camera |

| SL-169 | Implement battle HUD | P1 | SL-091 | HUD |

| SL-170 | Implement mode selector | P1 | SL-099 | Mode UI |

| SL-171 | Implement tactical command UI | P1 | SL-103 | Command UI |

| SL-172 | Implement ability UI | P1 | SL-111 | Ability UI |

| SL-173 | Implement pause interface | P1 | SL-091 | Pause UI |

| SL-174 | Implement results interface | P1 | SL-126 | Results UI |

| SL-175 | Implement collision feedback | P2 | SL-038 | Collision VFX |

| SL-176 | Implement ability feedback | P2 | SL-115 | Ability VFX |

| SL-177 | Implement spinning audio feedback | P2 | SL-028 | Rotational audio |



\## EPIC SL-178 — Application Flow



| ID | Task | Priority | Dependencies | Deliverable |

|---|---|---|---|---|

| SL-178 | Implement Main Menu | P1 | SL-078 | Main menu |

| SL-179 | Implement Top Selection | P1 | SL-162, SL-163 | Selection UI |

| SL-180 | Implement Battle Preparation | P1 | SL-179, SL-167 | Preparation UI |

| SL-181 | Implement Training Battle flow | P1 | SL-160, SL-180 | Training mode |

| SL-182 | Implement result and reward flow | P1 | SL-174, SL-127 | Reward flow |

| SL-183 | Implement return-to-menu flow | P1 | SL-182 | Application navigation |



\## EPIC SL-184 — Vertical Slice Integration



| ID | Task | Priority | Dependencies | Deliverable |

|---|---|---|---|---|

| SL-184 | Integrate complete battle flow | P0 | SL-181, SL-182 | Complete battle loop |

| SL-185 | Integrate persistent progression | P0 | SL-135, SL-182 | Persistent progression |

| SL-186 | Validate reward idempotency | P0 | SL-128, SL-185 | Reward integrity |

| SL-187 | Test desktop browser gameplay | P0 | SL-184 | Desktop test report |

| SL-188 | Test Android browser gameplay | P0 | SL-184 | Mobile test report |

| SL-189 | Profile Vertical Slice | P1 | SL-184 | Performance report |

| SL-190 | Approve Vertical Slice | P0 | SL-185, SL-187, SL-188, SL-189 | Milestone approval |



\---



\# 18. DEPENDENCY AND EXECUTION ORDER



The backlog must not be implemented as one large parallel development effort.



The recommended dependency sequence is:



```text

SL-001 to SL-016

&#x20;       │

&#x20;       ▼

SL-020 to SL-055

&#x20;       │

&#x20;       ▼

Feasibility Review

&#x20;       │

&#x20;       ▼

SL-060 to SL-083

&#x20;       │

&#x20;       ▼

SL-090 to SL-128

&#x20;       │

&#x20;       ▼

SL-130 to SL-151

&#x20;       │

&#x20;       ▼

SL-160 to SL-183

&#x20;       │

&#x20;       ▼

SL-184 to SL-190

&#x20;       │

&#x20;       ▼

Vertical Slice Approval

```



Some tasks can run in parallel after their dependencies are complete.



Examples:



\- Camera development and physics development.

\- Content authoring and UI prototyping.

\- AI development and persistence implementation.

\- Audio production and arena visual production.



However, integration tasks must wait until the relevant contracts and interfaces are stable.



\## 18.1 Critical Path



The initial critical path is:



1\. Unity project setup.

2\. WebGL configuration.

3\. Rotational simulation.

4\. Physics-driven movement.

5\. Wall collision.

6\. Browser validation.

7\. Feasibility approval.

8\. Domain and runtime architecture.

9\. Battle orchestration.

10\. Victory evaluation.

11\. Persistence.

12\. Vertical Slice integration.



The critical path must be reviewed after each milestone.



\## 18.2 Parallel Development Rules



Tasks may be assigned to separate developers or agents only when:



\- Their interfaces are defined.

\- Their dependencies are complete.

\- Their output contracts are known.

\- Their ownership boundaries are clear.



Two contributors must not independently modify the same core contract without coordination.



\---



\# 19. TESTING STRATEGY



\## 19.1 EditMode Tests



Required coverage:



\- Attribute calculations.

\- Component validation.

\- Content ID validation.

\- Element interaction calculations.

\- Ability validation.

\- Battle state transitions.

\- Reward calculations.

\- Save schema validation.

\- Save migrations.



\## 19.2 PlayMode Tests



Required coverage:



\- Top instantiation.

\- Component assembly.

\- Rotational simulation.

\- Ground contact.

\- Wall collision.

\- Top-to-top collision.

\- Camera tracking.

\- Battle state transitions.

\- Ability activation.

\- AI decision execution.

\- Victory evaluation.



\## 19.3 Web Tests



Required coverage:



\- WebGL initialization.

\- Browser input.

\- Touch input.

\- Fullscreen.

\- Audio activation.

\- Page visibility.

\- IndexedDB persistence.

\- Storage failure handling.

\- Asset loading.

\- Browser refresh.

\- WebGL context loss behavior.



\## 19.4 Regression Tests



Every fix involving physics, combat, progression, or persistence must include a regression test where practical.



No change to rendering quality settings may silently modify gameplay simulation behavior.



\---



\# 20. PERFORMANCE AND QUALITY GATES



\## 20.1 Feasibility Gate



Must prove:



\- Browser launch.

\- Physical rotation.

\- Movement.

\- Wall collision.

\- Camera.

\- Desktop controls.

\- Touch controls.

\- Browser suspension handling.



No complete gameplay development before this gate passes.



\## 20.2 Architecture Gate



Must prove:



\- Module boundaries.

\- Content definitions.

\- Runtime object creation.

\- Dependency injection.

\- Data validation.

\- Platform abstraction.



\## 20.3 Combat Gate



Must prove:



\- Battle lifecycle.

\- Battle Modes.

\- Tactical Commands.

\- Abilities.

\- AI.

\- Victory evaluation.



\## 20.4 Persistence Gate



Must prove:



\- Browser save.

\- Browser load.

\- Schema validation.

\- Recovery.

\- Duplicate reward prevention.



\## 20.5 Vertical Slice Gate



Must prove the entire gameplay loop on the actual browser build.



The Unity Editor alone is not an acceptable validation environment for the web release.



\## 20.6 Performance Targets



Initial targets:



| Metric | Target |

|---|---|

| Desktop | 60 FPS |

| Android | 30–60 FPS |

| Simulation | Stable 50 Hz target |

| UI response | Under 100 ms |

| Battle duration | 60–120 seconds |

| Initial playable load | Target under 15 seconds on a defined reference connection |

| Persistent physics failures | Zero |

| Save corruption | Zero in acceptance testing |



All targets must be measured against documented reference devices.



Performance claims must not be based on developer workstation results alone.



\---



\# 21. DEVELOPMENT WORKFLOW



\## 21.1 Task Completion Requirements



Every completed task must provide:



1\. Implemented code or content.

2\. Relevant tests.

3\. Build validation where applicable.

4\. Updated documentation.

5\. Known limitations.

6\. Acceptance criteria results.



A task is not complete merely because a script or asset was created.



\## 21.2 Git Workflow



Recommended branch structure:



```text

main

develop

feature/SL-026-rotation-state

feature/SL-035-movement

feature/SL-041-camera

feature/SL-131-storage-interface

bugfix/SL-037-wall-collision

```



Each feature branch should reference its task ID.



Changes must be reviewed before merging into the main development branch.



\## 21.3 Commit Rules



Commit messages should identify the task:



```text

feat(SL-026): define top simulation state

feat(SL-028): implement angular velocity state

fix(SL-037): stabilize arena wall collisions

test(SL-051): add desktop browser validation

```



\## 21.4 Technical Decision Records



Major architectural changes must be documented in:



`Documentation/Decisions/`



Examples:



\- Physics model changes.

\- Rendering pipeline changes.

\- Storage implementation changes.

\- Addressables strategy changes.

\- Browser compatibility decisions.

\- Multiplayer architecture decisions.



\---



\# 22. KNOWN TECHNICAL RISKS



| Risk | Impact | Mitigation |

|---|---|---|

| WebGL memory constraints | High | Early profiling and controlled asset loading |

| Mobile GPU limitations | High | Quality profiles and shader simplification |

| Physics instability | High | Controlled timestep and simulation calibration |

| Browser suspension | Medium | Lifecycle integration |

| IndexedDB failures | High | Recovery and storage validation |

| Long initial download | High | Progressive asset loading |

| Unsupported rendering features | High | Browser-compatible URP configuration |

| Unity physics non-determinism | Medium | Server validation for future multiplayer |

| Addressables version mismatch | High | Versioned deployment and compatibility checks |

| Touch control limitations | Medium | Dedicated mobile UX testing |



\## 22.1 Important Physics Risk



The initial spinning-top model is an approximation.



The team must validate:



\- Angular momentum behavior.

\- Gyroscopic stability.

\- Contact response.

\- Energy conservation and loss.

\- Collision-induced rotation changes.



A visually convincing spinning object is not sufficient.



The model must produce meaningful and repeatable gameplay behavior.



\## 22.2 Important Web Risk



Unity WebGL is constrained by browser memory, rendering APIs, threading, and mobile device behavior.



The first prototype is therefore a mandatory technical gate.



If the selected configuration fails, the team must evaluate alternative implementation strategies before producing the full content catalog.



\---



\# 23. OUT OF SCOPE



The following are explicitly excluded from the first Vertical Slice:



\- Multiplayer.

\- Ranked matchmaking.

\- Global leaderboards.

\- Trading.

\- Guilds.

\- Social systems.

\- Online tournaments.

\- Cloud synchronization.

\- Real-money purchases.

\- Advanced economy.

\- Full evolution system.

\- Multiple arenas.

\- Full content catalog.

\- Advanced boss battles.

\- Machine-learning-based AI.

\- User-generated content.



These features may be introduced in later milestones without changing the core architecture.



\---



\# 24. FIRST DEVELOPMENT MILESTONES



| Milestone | Goal | Exit Condition |

|---|---|---|

| M0 | Unity Foundation | Project builds |

| M1 | Web Feasibility | Browser prototype passes |

| M2 | Physics Foundation | Stable spinning simulation |

| M3 | Runtime Architecture | Content and runtime systems work |

| M4 | Combat Foundation | Complete basic combat loop |

| M5 | Web Persistence | Browser saves work |

| M6 | Vertical Slice | Complete playable battle |

| M7 | Optimization | Performance targets validated |



Milestones are quality gates, not fixed calendar deadlines.



The duration of each milestone must be estimated after the relevant technical uncertainty has been reduced.



\---



\# 25. IMMEDIATE EXECUTION PLAN



The first development iteration must be limited to the following tasks:



\*\*Iteration 1 — Web Feasibility\*\*



\- SL-001 — Create Git repository.

\- SL-002 — Initialize Unity 6 LTS project.

\- SL-003 — Configure URP.

\- SL-004 — Configure WebGL build target.

\- SL-007 — Create project folder structure.

\- SL-020 — Create WebPrototype scene.

\- SL-021 — Create prototype arena floor.

\- SL-022 — Create arena boundaries.

\- SL-024 — Create prototype top model.

\- SL-025 — Configure Rigidbody and collider.

\- SL-026 — Define simulation state.

\- SL-027 — Implement fixed simulation clock.

\- SL-028 — Implement angular velocity state.

\- SL-029 — Implement rotational energy calculation.

\- SL-030 — Implement rotational damping.

\- SL-031 — Implement visual rotation synchronization.

\- SL-035 — Implement movement intent model.

\- SL-036 — Implement translational movement.

\- SL-037 — Implement arena wall collision response.

\- SL-041 — Implement camera follow.

\- SL-042 — Implement desktop movement input.

\- SL-044 — Implement touch joystick.

\- SL-047 — Implement browser lifecycle adapter.

\- SL-048 — Implement performance monitor.

\- SL-050 — Build first WebGL prototype.

\- SL-051 — Test Chrome desktop.

\- SL-052 — Test Chrome Android.

\- SL-054 — Measure memory and startup.

\- SL-055 — Review feasibility results.



The first iteration must produce a working browser prototype, not merely a collection of source files.



No complete combat system, progression system, or content production should begin before the feasibility decision.



\---



\# 26. FINAL ENGINEERING PRINCIPLES



1\. One gameplay implementation must serve all supported platforms.

2\. Domain rules must remain independent of Unity scenes and UI.

3\. Physical simulation must remain separate from visual presentation.

4\. Rotational physics must be meaningful, measurable, and configurable.

5\. Static content definitions must be separate from player-owned state.

6\. Every persistent object must have a stable identity.

7\. Every major module must have a defined responsibility.

8\. Browser-specific APIs must remain isolated.

9\. Every feature must have explicit acceptance criteria.

10\. Every task must have traceable dependencies.

11\. Performance must be validated on real target devices.

12\. No large-scale content production before the Web Feasibility Prototype passes.

13\. No feature should require a future architectural rewrite merely because multiplayer or another platform is introduced.

14\. Quality gates must be passed before moving to the next major milestone.



\---



\# 27. DEFINITION OF SUCCESS



The first engineering objective is achieved when Spin Legends can run inside Chrome on desktop and Android, with one physically simulated spinning top moving inside a 3D arena, colliding with boundaries, responding to user input, and maintaining stable performance.



The first Vertical Slice objective is achieved when a player can launch the game, select a top, enter a battle, interact strategically, defeat an AI opponent, receive a reward, save progression, and repeat the experience.



The project must progress through verified engineering milestones rather than assumptions.



\*\*The first deliverable is a working WebGL prototype. The first product-quality deliverable is the Vertical Slice.\*\*



