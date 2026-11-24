\# SPIN LEGENDS

\## Technical Design Document (TECHNICAL\_DESIGN)



\*\*Document Version:\*\* 1.0  

\*\*Status:\*\* Initial Technical Architecture  

\*\*Related Documents:\*\* SPEC.md, GAME\_DESIGN.md  

\*\*Engine:\*\* Unity 6 LTS  

\*\*Language:\*\* C#  

\*\*Rendering Pipeline:\*\* Universal Render Pipeline (URP)  

\*\*Platforms:\*\* Windows PC / Android



\---



\# 1. TECHNICAL OVERVIEW



\## 1.1. Architecture Goals



The technical architecture must support:



\- Modular gameplay systems.

\- Data-driven game content.

\- Physics-driven combat.

\- Autonomous spinning top behavior.

\- Configurable AI opponents.

\- Reusable combat mechanics.

\- Cross-platform input.

\- Offline-first gameplay.

\- Local progression and persistence.

\- Future multiplayer integration.

\- Performance optimization for mobile devices.

\- Testable and independently maintainable systems.



The architecture must avoid unnecessary dependencies between gameplay modules.



Core gameplay logic must not depend directly on UI, platform-specific input, or external networking services.



\## 1.2. Architectural Principles



\### Separation of Responsibilities



Every major system must have a clearly defined responsibility.



\### Data-Driven Design



Gameplay definitions must be stored as data rather than hardcoded into individual gameplay scripts.



\### Composition Over Inheritance



Spinning tops and gameplay entities should be assembled from independent components and capabilities.



\### Explicit State Management



Battle states, entity states, and progression states must have explicit transitions.



\### Deterministic Rules Where Possible



Gameplay calculations should use controlled inputs and predictable rules.



Unity physics itself must not be assumed to be deterministic across different devices.



\### Offline First



The complete initial game must operate without authentication, network connectivity, or external services.



\### Multiplayer-Ready Boundaries



Gameplay systems must communicate through well-defined interfaces so that future network synchronization can be added without replacing core gameplay logic.



\---



\# 2. TECHNOLOGY STACK



\## 2.1. Core Technologies



| Technology | Responsibility |

|---|---|

| Unity 6 LTS | Main game engine |

| C# | Gameplay and application logic |

| URP | Rendering pipeline |

| Unity Physics | Physical simulation |

| Input System | Keyboard, mouse, and touch |

| ScriptableObjects | Static gameplay definitions |

| TextMeshPro | UI text rendering |

| Addressables | Optional content loading |

| Unity Test Framework | Automated testing |

| Blender | 3D modeling and asset creation |



\## 2.2. Platform Targets



\### Windows



Initial target:



\- Windows 10 and newer.

\- Keyboard and mouse.

\- 60 FPS target.

\- Configurable graphics quality.

\- 1920x1080 reference resolution.



\### Android



Initial target:



\- Android 9 and newer.

\- Touch input.

\- 30–60 FPS depending on hardware.

\- Configurable graphics quality.

\- Adaptive rendering resolution.



The final minimum device specification must be established through profiling.



\## 2.3. Package Management



Unity packages must be managed through Package Manager and recorded in the project manifest.



Third-party dependencies must be minimized.



Every third-party package must have:



\- A documented purpose.

\- A version constraint.

\- A licensing review.

\- A replacement strategy where practical.



\---



\# 3. HIGH-LEVEL ARCHITECTURE



\## 3.1. System Layers



The project is divided into five logical layers.



```text

Presentation Layer

&#x20;   |

&#x20;   v

Application Layer

&#x20;   |

&#x20;   v

Gameplay Domain Layer

&#x20;   |

&#x20;   v

Simulation Layer

&#x20;   |

&#x20;   v

Infrastructure Layer

```



\### Presentation Layer



Responsibilities:



\- UI.

\- HUD.

\- Camera.

\- Visual effects.

\- Audio presentation.

\- Animation.

\- Input visualization.



\### Application Layer



Responsibilities:



\- Game flow.

\- Scene transitions.

\- Battle orchestration.

\- Collection management.

\- Workshop operations.

\- Progression workflows.

\- Save coordination.



\### Gameplay Domain Layer



Responsibilities:



\- Spinning top definitions.

\- Equipment rules.

\- Attributes.

\- Battle rules.

\- Tactical commands.

\- Battle modes.

\- Abilities.

\- Elemental interactions.

\- Victory conditions.



\### Simulation Layer



Responsibilities:



\- Physical entities.

\- Movement.

\- Angular motion.

\- Collisions.

\- Ground contact.

\- Stability.

\- Environmental forces.

\- Simulation state.



\### Infrastructure Layer



Responsibilities:



\- Persistence.

\- Content loading.

\- Configuration.

\- Logging.

\- Platform services.

\- Future networking.

\- Diagnostics.



\## 3.2. Dependency Rules



Dependencies must flow toward the core gameplay definitions.



The domain layer must not reference:



\- Unity UI.

\- Scene management.

\- Platform input.

\- Network SDKs.

\- Specific presentation components.



The simulation layer may use Unity physics APIs through controlled adapters.



Presentation components must consume gameplay state rather than directly modifying domain data.



\---



\# 4. PROJECT STRUCTURE



Recommended initial directory structure:



```text

Assets/

|

+-- \_Project/

&#x20;   |

&#x20;   +-- Art/

&#x20;   |   +-- Models/

&#x20;   |   +-- Materials/

&#x20;   |   +-- Textures/

&#x20;   |   +-- Animations/

&#x20;   |   +-- VFX/

&#x20;   |   +-- Audio/

&#x20;   |

&#x20;   +-- Data/

&#x20;   |   +-- Tops/

&#x20;   |   +-- Components/

&#x20;   |   +-- Abilities/

&#x20;   |   +-- Elements/

&#x20;   |   +-- Arenas/

&#x20;   |   +-- AI/

&#x20;   |   +-- Progression/

&#x20;   |   +-- Balance/

&#x20;   |

&#x20;   +-- Prefabs/

&#x20;   |   +-- SpinningTops/

&#x20;   |   +-- Components/

&#x20;   |   +-- Arenas/

&#x20;   |   +-- UI/

&#x20;   |   +-- VFX/

&#x20;   |

&#x20;   +-- Scenes/

&#x20;   |   +-- Bootstrap.unity

&#x20;   |   +-- MainMenu.unity

&#x20;   |   +-- Workshop.unity

&#x20;   |   +-- Battle.unity

&#x20;   |   +-- Results.unity

&#x20;   |

&#x20;   +-- Scripts/

&#x20;   |   |

&#x20;   |   +-- Core/

&#x20;   |   |   +-- Bootstrap/

&#x20;   |   |   +-- Events/

&#x20;   |   |   +-- State/

&#x20;   |   |   +-- Configuration/

&#x20;   |   |

&#x20;   |   +-- Domain/

&#x20;   |   |   +-- Tops/

&#x20;   |   |   +-- Components/

&#x20;   |   |   +-- Attributes/

&#x20;   |   |   +-- Abilities/

&#x20;   |   |   +-- Elements/

&#x20;   |   |   +-- Combat/

&#x20;   |   |   +-- Progression/

&#x20;   |   |

&#x20;   |   +-- Simulation/

&#x20;   |   |   +-- Physics/

&#x20;   |   |   +-- Movement/

&#x20;   |   |   +-- Rotation/

&#x20;   |   |   +-- Collision/

&#x20;   |   |   +-- Stability/

&#x20;   |   |   +-- Arena/

&#x20;   |   |

&#x20;   |   +-- AI/

&#x20;   |   |   +-- Perception/

&#x20;   |   |   +-- Decision/

&#x20;   |   |   +-- Behaviors/

&#x20;   |   |   +-- Steering/

&#x20;   |   |

&#x20;   |   +-- Application/

&#x20;   |   |   +-- GameFlow/

&#x20;   |   |   +-- Battle/

&#x20;   |   |   +-- Workshop/

&#x20;   |   |   +-- Collection/

&#x20;   |   |   +-- Rewards/

&#x20;   |   |

&#x20;   |   +-- Presentation/

&#x20;   |   |   +-- UI/

&#x20;   |   |   +-- HUD/

&#x20;   |   |   +-- Camera/

&#x20;   |   |   +-- VFX/

&#x20;   |   |   +-- Audio/

&#x20;   |   |

&#x20;   |   +-- Infrastructure/

&#x20;   |       +-- Persistence/

&#x20;   |       +-- Content/

&#x20;   |       +-- Logging/

&#x20;   |       +-- Platform/

&#x20;   |       +-- Networking/

&#x20;   |

&#x20;   +-- Settings/

&#x20;   +-- Tests/

&#x20;       +-- EditMode/

&#x20;       +-- PlayMode/

&#x20;       +-- Performance/

```



The structure should remain modular without creating excessive assemblies or folders for trivial functionality.



\---



\# 5. ASSEMBLY DEFINITIONS



Assembly Definition files should be introduced to enforce module boundaries.



Recommended assemblies:



| Assembly | Responsibility |

|---|---|

| SpinLegends.Core | Shared primitives and infrastructure contracts |

| SpinLegends.Domain | Gameplay definitions and rules |

| SpinLegends.Simulation | Physical simulation |

| SpinLegends.AI | Autonomous behavior |

| SpinLegends.Application | Gameplay orchestration |

| SpinLegends.Presentation | UI, camera, audio, and VFX |

| SpinLegends.Infrastructure | Persistence and platform services |

| SpinLegends.Tests | Automated tests |



Dependencies must follow the architecture rules.



Circular assembly dependencies are prohibited.



\---



\# 6. CORE DOMAIN MODEL



\## 6.1. Static Definitions and Runtime Instances



The architecture must distinguish between static definitions and runtime instances.



\### Static Definitions



Describe what an item or gameplay entity is.



Examples:



\- TopDefinition.

\- ComponentDefinition.

\- AbilityDefinition.

\- ElementDefinition.

\- ArenaDefinition.

\- AIPersonalityDefinition.



Static definitions should generally use ScriptableObjects.



\### Runtime Instances



Represent actual objects during gameplay.



Examples:



\- OwnedTop.

\- BattleTop.

\- ComponentInstance.

\- AbilityRuntime.

\- BattleParticipant.

\- BattleState.



Runtime state must not be stored inside shared ScriptableObject assets.



This prevents multiple entities from accidentally sharing mutable state.



\## 6.2. Identifier Strategy



All persistent content must use stable identifiers.



Recommended identifier format:



```text

top.core.ember

component.blade.ironfang

ability.fire.flame\_burst

arena.neon\_stadium

ai.personality.aggressive

```



Identifiers must remain stable across releases.



Display names must never be used as database identifiers.



\## 6.3. Definition Interfaces



Recommended conceptual interfaces:



```csharp

public interface IGameDefinition

{

&#x20;   string Id { get; }

}



public interface IValidatable

{

&#x20;   ValidationResult Validate();

}

```



All definitions must support validation.



Validation should detect:



\- Missing identifiers.

\- Duplicate identifiers.

\- Invalid attribute ranges.

\- Missing references.

\- Invalid ability configurations.

\- Incompatible equipment combinations.



\---



\# 7. SPINNING TOP SYSTEM



\## 7.1. Main Definition



`TopDefinition` describes the default characteristics of a spinning top.



Responsibilities:



\- Base attributes.

\- Default components.

\- Elemental identity.

\- Archetype.

\- Evolution configuration.

\- Available abilities.

\- Visual identity.



\## 7.2. Owned Top



`OwnedTop` represents a player's individual spinning top.



Recommended fields:



```text

InstanceId

DefinitionId

DisplayName

Level

Experience

EvolutionStage

ComponentInstances

AbilityLoadout

CosmeticConfiguration

OwnershipMetadata

```



\## 7.3. Battle Top



`BattleTop` represents the runtime combat entity.



It contains:



```text

EntityId

OwnerId

DefinitionId

CurrentComponents

CalculatedAttributes

CurrentStamina

CurrentEnergy

CurrentResonance

StructuralState

BattleMode

TacticalCommand

PhysicalState

AbilityStates

```



BattleTop must be initialized from validated configuration data.



It must not reference the player's mutable collection data directly.



\## 7.4. Equipment Assembly



The assembly process:



```text

OwnedTop

&#x20;   |

&#x20;   v

Load Top Definition

&#x20;   |

&#x20;   v

Resolve Component Definitions

&#x20;   |

&#x20;   v

Validate Compatibility

&#x20;   |

&#x20;   v

Calculate Final Attributes

&#x20;   |

&#x20;   v

Calculate Physical Properties

&#x20;   |

&#x20;   v

Build Runtime Configuration

&#x20;   |

&#x20;   v

Create Battle Entity

```



Invalid configurations must fail before battle initialization.



\## 7.5. Physical Configuration



The assembled top must generate a physical configuration.



Recommended data:



```text

TotalMass

CenterOfMass

MomentOfInertia

ColliderConfiguration

GroundContactProfile

FrictionProfile

RotationalDrag

Restitution

StructuralResistance

```



Physical properties must be calculated from the selected components.



They must not be independently assigned through arbitrary attribute bonuses.



\---



\# 8. SCRIPTABLEOBJECT DATA MODEL



\## 8.1. TopDefinition



Responsibilities:



\- Base attributes.

\- Archetype.

\- Element.

\- Default components.

\- Evolution references.

\- Visual references.



\## 8.2. ComponentDefinition



Fields:



```text

Id

DisplayName

Category

Rarity

Mass

LocalPosition

LocalRotation

ColliderProfile

MaterialProperties

AttributeModifiers

Durability

CompatibilityTags

VisualPrefab

```



\## 8.3. AbilityDefinition



Fields:



```text

Id

DisplayName

Category

Element

EnergyCost

ResonanceCost

Cooldown

Duration

TargetingRules

ActivationRules

EffectDefinitions

VisualPrefab

AudioDefinition

```



Ability effects should use reusable effect definitions.



\## 8.4. ArenaDefinition



Fields:



```text

Id

DisplayName

ArenaPrefab

ArenaBounds

SurfaceProfiles

SpawnPoints

EnvironmentEffects

BattleRules

CameraSettings

```



\## 8.5. AIPersonalityDefinition



Fields:



```text

Id

DecisionWeights

ReactionProfile

RiskTolerance

EngagementPreference

ResourceManagement

AbilityUsageProfile

BehaviorPriorities

```



\## 8.6. BalanceConfiguration



All gameplay tuning values must be centralized.



Examples:



\- Stamina thresholds.

\- Collision multipliers.

\- Elemental modifiers.

\- Ability limits.

\- Command durations.

\- Mode costs.

\- Resonance generation.

\- Victory thresholds.



BalanceConfiguration must support versioning and validation.



\---



\# 9. ATTRIBUTE CALCULATION ENGINE



\## 9.1. Responsibility



The Attribute Calculation Engine calculates the effective gameplay attributes of an assembled spinning top.



It must not perform physical simulation.



\## 9.2. Calculation Pipeline



```text

Base Attributes

&#x20;     |

&#x20;     v

Component Modifiers

&#x20;     |

&#x20;     v

Upgrade Modifiers

&#x20;     |

&#x20;     v

Evolution Modifiers

&#x20;     |

&#x20;     v

Passive Ability Modifiers

&#x20;     |

&#x20;     v

Final Attribute Set

```



\## 9.3. Modifier Model



Every modifier must define:



```text

SourceId

Attribute

Operation

Value

Priority

Conditions

```



Supported operations:



\- Additive.

\- Multiplicative.

\- Override.



Modifier ordering must be explicit.



The calculation engine must produce the same output for the same validated inputs.



\## 9.4. Physical Properties



Physical properties must be calculated separately from normalized gameplay attributes.



For example:



```text

Attack Attribute != Collision Impulse

Speed Attribute != Linear Velocity

Stamina Attribute != Angular Velocity

Weight Attribute != Moment of Inertia

```



The attribute system may influence physical parameters through documented conversion rules.



\---



\# 10. PHYSICS SIMULATION ARCHITECTURE



\## 10.1. Simulation Ownership



The simulation system owns physical runtime state.



Other modules must not directly manipulate Rigidbody properties outside the simulation interfaces.



\## 10.2. Physics Entities



Each battle spinning top should use a controlled physics hierarchy.



Recommended hierarchy:



```text

BattleTopRoot

&#x20;   |

&#x20;   +-- Rigidbody

&#x20;   |

&#x20;   +-- PhysicalBody

&#x20;   |   +-- MainCollider

&#x20;   |   +-- StructuralColliders

&#x20;   |

&#x20;   +-- RotationVisual

&#x20;   |

&#x20;   +-- ComponentVisuals

&#x20;   |

&#x20;   +-- GroundContactSensors

```



The visual hierarchy must be separated from the physical root.



Visual rotation must not accidentally overwrite physical rotation.



\## 10.3. Rigidbody Configuration



Important parameters:



\- Mass.

\- Center of mass.

\- Inertia tensor.

\- Linear damping.

\- Angular damping.

\- Collision detection mode.

\- Interpolation.

\- Constraints.



Values must be calculated or assigned during runtime initialization.



Avoid arbitrary Rigidbody settings scattered across prefabs.



\## 10.4. Fixed Simulation Step



Physics must run through Unity's fixed simulation loop.



The initial target is a fixed timestep suitable for stable battle simulation.



The timestep must be configurable and tested on both target platforms.



A faster simulation rate may improve collision accuracy but increases CPU cost.



\## 10.5. Angular Motion



The rotational system must track:



\- Angular velocity.

\- Angular momentum.

\- Rotational energy.

\- Rotational drag.

\- Axis alignment.

\- Stability.



The implementation must distinguish visual spinning from actual physical angular motion.



\## 10.6. Rotational Energy Model



Rotational energy should be calculated from the physical simulation.



\\\[

E\_r = \\frac{1}{2}I\\omega^2

\\]



The stamina system observes rotational energy and converts it into normalized gameplay values.



The stamina system must not arbitrarily overwrite angular velocity every frame.



\## 10.7. Ground Contact



Ground contact must be evaluated using:



\- Contact points.

\- Contact normals.

\- Surface material.

\- Friction.

\- Normal force.

\- Relative velocity.



The ground contact system should provide information to:



\- Stability evaluation.

\- Rotational energy calculations.

\- Movement control.

\- Visual feedback.



\## 10.8. Collision Processing



Collision events must be converted into normalized gameplay events.



Example:



```text

Unity Collision

&#x20;   |

&#x20;   v

Collision Data Extraction

&#x20;   |

&#x20;   v

Contact Classification

&#x20;   |

&#x20;   v

Impulse Evaluation

&#x20;   |

&#x20;   v

Structural Damage Evaluation

&#x20;   |

&#x20;   v

Resonance Evaluation

&#x20;   |

&#x20;   v

Combat Event Publication

```



Do not distribute collision calculations across multiple MonoBehaviour scripts.



\## 10.9. Collision Event Data



Recommended collision event structure:



```text

AttackerEntityId

TargetEntityId

ContactPoint

ContactNormal

RelativeVelocity

ImpulseMagnitude

ImpactDirection

ContactClassification

SimulationTick

```



All derived combat effects must use this normalized collision data.



\## 10.10. Physics Materials



Physics materials must be configurable per component and arena surface.



Material properties must include:



\- Static friction.

\- Dynamic friction.

\- Bounciness.

\- Friction combination.

\- Bounce combination.



Unity's material combination behavior must be tested to ensure that actual friction behavior matches the design assumptions.



\## 10.11. Stability Evaluation



The Stability System must calculate a normalized stability state.



Inputs:



\- Angular velocity.

\- Rotational energy.

\- Center of mass.

\- Ground contact.

\- Physical orientation.

\- Recent collision impulses.



Outputs:



\- Stability value.

\- Wobble intensity.

\- Recovery capability.

\- Instability state.



Visual wobble should be driven by the simulation state.



It must not become an independent source of physical movement.



\---



\# 11. COMBAT DOMAIN SYSTEM



\## 11.1. Combat Orchestrator



`BattleOrchestrator` coordinates the overall battle.



Responsibilities:



\- Initialize participants.

\- Start the battle.

\- Manage battle phases.

\- Process combat events.

\- Evaluate victory conditions.

\- Complete the battle.

\- Publish results.



It must not implement detailed physics or AI algorithms.



\## 11.2. Battle State



Recommended battle states:



```text

Idle

Preparation

Launch

Combat

Critical

Finish

Results

Rewards

Completed

Aborted

```



State transitions must be explicit.



Invalid transitions must be rejected.



\## 11.3. Battle State Data



```text

BattleId

BattleType

CurrentPhase

CurrentSimulationTick

StartTimestamp

Participants

ArenaId

BattleRules

WinnerEntityId

FinishReason

BattleStatistics

```



\## 11.4. Combat Event System



Combat events should be immutable messages.



Examples:



\- BattleStarted.

\- TopLaunched.

\- CollisionOccurred.

\- StaminaChanged.

\- StabilityChanged.

\- ComponentDamaged.

\- ComponentFailed.

\- AbilityActivated.

\- BattleModeChanged.

\- TacticalCommandChanged.

\- ResonanceChanged.

\- RingOutDetected.

\- SpinFinishDetected.

\- BattleCompleted.



Events must not become a replacement for direct state ownership.



The system that owns a state must be responsible for modifying it.



\## 11.5. Event Dispatching



Use typed events or a controlled event dispatcher.



Avoid unrestricted global event systems.



Event subscriptions must have clear lifecycle management to prevent duplicate listeners and memory leaks.



\---



\# 12. TACTICAL CONTROL SYSTEM



\## 12.1. Tactical Command Runtime



`TacticalCommandController` owns the current tactical command.



It must track:



```text

CurrentCommand

CommandStartTick

MinimumCommitment

MaximumDuration

Cooldown

Priority

InterruptionRules

```



\## 12.2. Command Interpretation



Commands must be translated into behavioral objectives.



Examples:



| Command | Behavioral Objective |

|---|---|

| Aggressive | Increase engagement priority |

| Defensive | Reduce exposure to dangerous engagements |

| Chase | Intercept opponent position |

| Circle | Maintain orbital movement |

| Evade | Avoid predicted collision |

| Hold Position | Maintain a designated area |

| Counter | Prepare for defensive retaliation |

| Conserve Energy | Minimize unnecessary energy loss |



\## 12.3. Command Validation



Before accepting a command, validate:



\- Battle phase.

\- Entity state.

\- Command availability.

\- Cooldown.

\- Command restrictions.

\- Current interruption state.



Invalid commands must return an explicit result.



\---



\# 13. BATTLE MODE SYSTEM



\## 13.1. Mode Runtime



`BattleModeController` owns the active Battle Mode.



It must track:



```text

ActiveMode

ActivationTick

Duration

EnergyCost

Cooldown

ModeModifiers

```



\## 13.2. Mode Modifiers



Modes should use reusable modifier definitions.



Examples:



\- Movement priority.

\- Offensive priority.

\- Defensive priority.

\- Rotational drag modifier.

\- Energy consumption modifier.

\- Stability modifier.

\- Steering responsiveness.



\## 13.3. Mode Calculation



Mode effects must be evaluated by the relevant gameplay systems.



The mode controller should not directly modify unrelated systems.



For example:



\- Movement modifiers are consumed by movement control.

\- Energy modifiers are consumed by resource management.

\- Offensive modifiers are consumed by combat calculations.



\## 13.4. Mode Switching



Mode switching must be validated by the battle state and resource systems.



Transitions must be controlled to avoid instant modifier stacking.



\---



\# 14. ABILITY EXECUTION SYSTEM



\## 14.1. Ability Runtime



Each ability slot must have an independent runtime state.



Recommended fields:



```text

AbilityId

CurrentState

CooldownRemaining

ActivationTick

RemainingDuration

```



\## 14.2. Ability Lifecycle



```text

Available

Requested

Validated

Executing

Completed

Cooldown

Unavailable

```



\## 14.3. Ability Executor



`AbilityExecutor` receives validated activation requests.



It must:



1\. Validate the ability definition.

2\. Validate the current battle state.

3\. Validate resource availability.

4\. Validate targeting requirements.

5\. Consume resources.

6\. Execute the configured effects.

7\. Publish activation events.

8\. Start cooldown management.



\## 14.4. Effect Architecture



Abilities should use composable effect definitions.



Examples:



\- ApplyMovementImpulse.

\- ApplyTemporaryShield.

\- ModifyRotationalDrag.

\- ApplyStatusEffect.

\- ModifyOpponentMovement.

\- CreateEnvironmentalEffect.

\- RestoreEnergy.

\- ApplyStructuralDamage.



Effects must have defined duration, stacking rules, and cancellation behavior.



\## 14.5. Effect Stacking



The effect system must define:



\- Stackable effects.

\- Non-stackable effects.

\- Refreshable effects.

\- Strongest-effect-only effects.

\- Mutually exclusive effects.



These rules must be defined per effect type.



\## 14.6. Resource Transactions



Ability activation must be atomic at the gameplay level.



If validation fails, resources must not be consumed.



If activation succeeds, costs must be recorded before effects are applied.



\---



\# 15. RESOURCE MANAGEMENT



\## 15.1. Independent Resources



The system must distinguish:



\- Rotational Stamina.

\- Ability Energy.

\- Resonance.

\- Structural Durability.



Each resource has a separate owner and calculation model.



\## 15.2. Rotational Stamina



Derived from physical rotational energy.



The simulation system owns the physical state.



The stamina presentation layer consumes normalized values.



\## 15.3. Ability Energy



Owned by the combat resource system.



Consumed by abilities and selected modes.



Regeneration rules must be configurable.



\## 15.4. Resonance



Generated by validated combat events.



The resonance system must reject invalid or duplicated event processing.



\## 15.5. Structural Durability



Owned by the structural damage system.



Must be modified only by validated damage events.



\---



\# 16. AI ARCHITECTURE



\## 16.1. AI Controller



Every AI-controlled spinning top receives an `AIController`.



The controller coordinates:



\- Perception.

\- State evaluation.

\- Decision making.

\- Behavior selection.

\- Steering.



\## 16.2. Perception System



Perception must collect:



\- Opponent position.

\- Opponent velocity.

\- Opponent direction.

\- Relative distance.

\- Relative orientation.

\- Current stamina.

\- Current stability.

\- Current battle mode.

\- Arena boundaries.

\- Nearby hazards.

\- Ability availability.



Perception must not read arbitrary scene objects without an explicit interface.



\## 16.3. Decision System



The decision system evaluates candidate behaviors.



Recommended architecture:



\- Utility-based decision scoring.

\- Finite State Machine for execution.

\- Configurable personality weights.

\- Explicit interruption rules.



\## 16.4. Behavior Modules



Initial behaviors:



```text

ApproachBehavior

AttackBehavior

PursuitBehavior

OrbitBehavior

EvadeBehavior

RetreatBehavior

StabilizeBehavior

CounterBehavior

ConserveEnergyBehavior

```



Each behavior must expose:



\- Preconditions.

\- Utility score.

\- Priority.

\- Execution logic.

\- Completion conditions.

\- Interruption conditions.



\## 16.5. Steering System



The steering system converts selected objectives into movement requests.



It must account for:



\- Current velocity.

\- Desired direction.

\- Acceleration limits.

\- Physical constraints.

\- Arena boundaries.

\- Stability.

\- Current movement mode.



The steering system must not teleport entities or directly overwrite position.



\## 16.6. AI Performance



AI decision-making does not need to run every rendered frame.



Use configurable decision intervals.



Physics simulation must continue at its own fixed timestep.



AI decisions should be scheduled to avoid unnecessary CPU spikes when multiple entities are active.



\---



\# 17. ARENA SYSTEM



\## 17.1. Arena Runtime



`ArenaController` owns arena-specific runtime state.



Responsibilities:



\- Spawn points.

\- Boundary detection.

\- Surface information.

\- Environmental effects.

\- Arena-specific battle rules.

\- Hazard activation.



\## 17.2. Surface Profiles



Each arena surface must expose:



```text

SurfaceId

Friction

StaticFriction

DynamicFriction

MaterialProperties

ElementalModifiers

EnvironmentalEffects

```



\## 17.3. Boundary Detection



Boundary detection must be independent of visual meshes.



Use explicit collider geometry or dedicated boundary volumes.



Ring Out detection must validate the entity's physical state.



\## 17.4. Environmental Effects



Environmental effects must use reusable effect definitions.



Each effect must define:



\- Activation condition.

\- Duration.

\- Affected region.

\- Target rules.

\- Gameplay modifiers.

\- Visual representation.

\- Cooldown or recurrence rules.



\---



\# 18. INPUT ARCHITECTURE



\## 18.1. Input Abstraction



The game must use Unity's Input System.



Input devices must be translated into gameplay commands through an input abstraction layer.



Gameplay systems must not depend directly on keyboard keys or touch coordinates.



\## 18.2. PC Controls



Suggested initial controls:



| Action | Input |

|---|---|

| Select Aggressive | 1 |

| Select Defensive | 2 |

| Select Chase | 3 |

| Select Circle | 4 |

| Select Evade | 5 |

| Select Conserve Energy | 6 |

| Ability 1 | Q |

| Ability 2 | E |

| Ability 3 | R |

| Ultimate | F |

| Camera Zoom | Mouse Wheel |



Bindings must be configurable.



\## 18.3. Android Controls



Touch UI should expose:



\- Tactical command selection.

\- Battle mode selection.

\- Ability activation.

\- Ultimate activation.

\- Camera controls.

\- Battle information.



Touch controls must avoid overlapping important gameplay information.



\## 18.4. Input Command Model



Input should produce typed commands.



Examples:



```text

SelectTacticalCommand

SelectBattleMode

ActivateAbility

ActivateUltimate

RequestLaunch

CameraZoom

```



These commands are validated by the application and domain systems.



\---



\# 19. PRESENTATION ARCHITECTURE



\## 19.1. UI Architecture



Use a presentation model that separates UI rendering from gameplay state.



UI components must not directly modify physical entities.



The UI sends commands to application services and displays resulting state changes.



\## 19.2. Battle HUD



The HUD must display:



\- Player spinning top.

\- Opponent spinning top.

\- Stamina.

\- Energy.

\- Resonance.

\- Battle mode.

\- Tactical command.

\- Ability cooldowns.

\- Timer.

\- Battle events.



\## 19.3. Camera System



The camera system must be independent of the battle simulation.



Responsibilities:



\- Tracking.

\- Framing.

\- Zoom.

\- Collision-aware positioning.

\- Cinematic transitions.

\- Platform-specific presentation.



\## 19.4. VFX System



VFX must subscribe to relevant gameplay events.



Examples:



\- Collision sparks.

\- Elemental trails.

\- Ability effects.

\- Structural damage.

\- Burst effects.

\- Victory effects.



VFX must never be the source of gameplay truth.



\## 19.5. Audio System



Audio must use centralized event-driven playback.



Examples:



\- Launch.

\- Collision.

\- Rotational speed changes.

\- Stability loss.

\- Ability activation.

\- Ultimate activation.

\- Component failure.

\- Victory.



Spinning audio pitch and intensity should respond to actual angular velocity.



\---



\# 20. APPLICATION FLOW



\## 20.1. Bootstrap



The application must start through a bootstrap scene.



Bootstrap responsibilities:



\- Load global configuration.

\- Initialize services.

\- Initialize persistence.

\- Register content definitions.

\- Initialize platform services.

\- Load the main menu.



\## 20.2. Scene Management



Recommended scene flow:



```text

Bootstrap

&#x20;   |

&#x20;   v

Main Menu

&#x20;   |

&#x20;   +----> Workshop

&#x20;   |

&#x20;   +----> Collection

&#x20;   |

&#x20;   +----> Tournament

&#x20;   |

&#x20;   v

Battle

&#x20;   |

&#x20;   v

Results

&#x20;   |

&#x20;   v

Previous Menu

```



Scene transitions must preserve application-level state.



\## 20.3. Battle Initialization



Battle initialization must be performed by a dedicated application service.



Responsibilities:



1\. Load arena definition.

2\. Validate participant configurations.

3\. Create runtime entities.

4\. Initialize simulation.

5\. Initialize AI controllers.

6\. Initialize combat systems.

7\. Initialize presentation.

8\. Start battle preparation.



\---



\# 21. PERSISTENCE ARCHITECTURE



\## 21.1. Offline Save System



The initial version must support local persistence.



The save system must store:



\- Player profile.

\- Owned spinning tops.

\- Equipment configurations.

\- Progression.

\- Currency.

\- Unlocked content.

\- Tournament progress.

\- Settings.

\- Statistics.



\## 21.2. Save Format



Use a versioned structured format.



JSON is suitable for the initial implementation.



Binary formats may be considered later if performance or storage requirements justify them.



\## 21.3. Save Data Structure



Example:



```json

{

&#x20; "schemaVersion": 1,

&#x20; "profile": {

&#x20;   "playerId": "local-player",

&#x20;   "displayName": "Player"

&#x20; },

&#x20; "inventory": {

&#x20;   "gold": 1000,

&#x20;   "metalShards": 250,

&#x20;   "energyCrystals": 50

&#x20; },

&#x20; "ownedTops": \[],

&#x20; "unlockedContent": \[],

&#x20; "tournamentProgress": {},

&#x20; "statistics": {}

}

```



This is an illustrative structure, not a complete production save schema.



\## 21.4. Save Service



`SaveService` must provide:



\- Load.

\- Save.

\- Validate.

\- Backup.

\- Restore.

\- Migration.



\## 21.5. Data Integrity



The system must:



\- Validate loaded data.

\- Handle missing optional fields.

\- Reject invalid identifiers.

\- Prevent invalid resource values.

\- Recover from interrupted saves where possible.

\- Maintain a previous valid save.



\## 21.6. Atomic Saving



Use a safe write strategy:



1\. Serialize current state.

2\. Write to a temporary file.

3\. Flush and close.

4\. Validate the temporary file.

5\. Replace the previous save.

6\. Retain a recoverable backup.



\## 21.7. Save Migration



Every save schema must have a version.



When the schema changes:



\- Detect the previous version.

\- Run sequential migrations.

\- Validate the migrated result.

\- Save the new version.

\- Preserve a backup.



Never silently discard incompatible player data.



\---



\# 22. CONTENT MANAGEMENT



\## 22.1. Content Registry



The game must maintain a validated registry of static definitions.



The registry should index content by stable identifier.



Examples:



```text

TopDefinitions

ComponentDefinitions

AbilityDefinitions

ElementDefinitions

ArenaDefinitions

AIPersonalityDefinitions

EvolutionDefinitions

```



\## 22.2. Content Validation



At development time, validate:



\- Duplicate identifiers.

\- Missing references.

\- Invalid numerical ranges.

\- Missing prefabs.

\- Invalid compatibility tags.

\- Invalid ability effects.

\- Invalid evolution links.



Development builds should report actionable validation errors.



\## 22.3. Addressables



Addressables may be used for:



\- Optional arena content.

\- Additional component collections.

\- Large visual assets.

\- Future downloadable content.



Core gameplay definitions must remain available for the initial offline experience.



\---



\# 23. MULTIPLAYER EXTENSIBILITY



\## 23.1. Future Networking Strategy



The initial version is single-player and offline.



The architecture must nevertheless separate:



\- Player input.

\- Battle commands.

\- Simulation state.

\- Battle results.

\- Presentation.



Networking must not become a dependency of the gameplay domain.



\## 23.2. Network Abstraction



Future networking may use an adapter around a selected networking solution.



Possible candidates include:



\- Photon Fusion.

\- Unity Netcode for GameObjects.



The final selection must be based on the multiplayer requirements and technical validation.



\## 23.3. Simulation Authority



Online combat must not trust arbitrary client-reported results.



A future authoritative model must validate:



\- Player commands.

\- Equipment configuration.

\- Ability activation.

\- Resource consumption.

\- Battle progression.

\- Victory conditions.



\## 23.4. Physics Determinism



Unity physics must not be assumed to produce identical results across platforms.



Future multiplayer must evaluate one or more strategies:



\- Server-authoritative simulation.

\- State synchronization.

\- Prediction and reconciliation.

\- Periodic state correction.

\- Validated battle event replication.



The appropriate strategy depends on latency, simulation cost, and competitive requirements.



\## 23.5. Simulation Snapshots



The architecture should support capturing relevant battle state.



A snapshot may contain:



```text

SimulationTick

EntityPositions

EntityRotations

LinearVelocities

AngularVelocities

Stamina

Energy

Resonance

StructuralState

BattleModes

TacticalCommands

AbilityStates

```



Snapshots may support debugging, replay, and future synchronization.



\---



\# 24. PERFORMANCE ARCHITECTURE



\## 24.1. Performance Targets



Initial targets:



| Metric | PC | Android |

|---|---:|---:|

| Target FPS | 60 | 30–60 |

| Battle Duration | 60–120 sec | 60–120 sec |

| Loading | Under 5 sec | Under 5 sec |

| UI Response | Under 100 ms | Under 100 ms |



Targets must be verified on reference hardware.



\## 24.2. Physics Optimization



\- Limit unnecessary rigidbodies.

\- Use simplified colliders.

\- Avoid excessive continuous collision detection.

\- Avoid unnecessary physics queries.

\- Use appropriate fixed timestep settings.

\- Profile collision callback overhead.

\- Separate visual effects from physical simulation.



\## 24.3. AI Optimization



\- Use configurable decision intervals.

\- Avoid unnecessary allocations.

\- Reuse perception data.

\- Avoid repeated scene-wide searches.

\- Limit expensive predictive calculations.

\- Use centralized scheduling where appropriate.



\## 24.4. Rendering Optimization



For Android:



\- Use GPU-friendly materials.

\- Limit transparent overdraw.

\- Use particle budgets.

\- Use LOD where appropriate.

\- Optimize shadows.

\- Limit dynamic lights.

\- Use configurable visual quality.



\## 24.5. Memory Management



\- Pool frequently created VFX.

\- Reuse temporary collections.

\- Avoid per-frame allocations.

\- Release unused Addressables.

\- Monitor texture and mesh memory.

\- Avoid unnecessary runtime material instantiation.



\## 24.6. Profiling



Performance must be measured using:



\- Unity Profiler.

\- Frame Debugger.

\- Memory Profiler.

\- Device profiling.

\- Physics profiling.

\- Rendering statistics.



Performance decisions must be based on measurements rather than assumptions.



\---



\# 25. ERROR HANDLING AND LOGGING



\## 25.1. Error Categories



Errors should be classified as:



\- Configuration errors.

\- Content validation errors.

\- Gameplay validation errors.

\- Persistence errors.

\- Simulation errors.

\- Platform errors.

\- Unexpected runtime errors.



\## 25.2. Logging



Use centralized structured logging.



Logs should include:



\- Timestamp.

\- Severity.

\- System.

\- Event identifier.

\- Relevant entity identifiers.

\- Diagnostic information.



Avoid excessive logging during normal gameplay.



\## 25.3. Recovery



The application should recover from:



\- Missing optional content.

\- Invalid cosmetic references.

\- Failed save loading.

\- Interrupted scene transitions.

\- Invalid battle configurations.



Critical gameplay configuration errors must not be silently ignored.



\---



\# 26. TESTING ARCHITECTURE



\## 26.1. Unit Tests



Test independent domain calculations.



Examples:



\- Attribute calculation.

\- Modifier ordering.

\- Elemental interactions.

\- Ability validation.

\- Resource consumption.

\- Victory condition evaluation.

\- Progression calculations.



\## 26.2. Physics Tests



Test:



\- Rotational energy behavior.

\- Angular momentum.

\- Collision response.

\- Ground friction.

\- Stability transitions.

\- Ring Out detection.

\- Physical configuration differences.



Physics tests should use tolerances rather than requiring exact cross-platform floating-point equality.



\## 26.3. AI Tests



Test:



\- Behavior selection.

\- Command interpretation.

\- Personality differences.

\- Boundary avoidance.

\- Ability timing.

\- Energy conservation.



\## 26.4. Integration Tests



Test complete workflows:



\- Assemble a spinning top.

\- Enter a battle.

\- Launch entities.

\- Execute tactical commands.

\- Activate abilities.

\- Complete a battle.

\- Calculate rewards.

\- Save progression.

\- Reload progression.



\## 26.5. PlayMode Tests



PlayMode tests must validate actual Unity scene and simulation behavior.



\## 26.6. Performance Tests



Test representative scenarios:



\- Two spinning tops.

\- Multiple active VFX.

\- High collision frequency.

\- Maximum expected AI activity.

\- Long battle sessions.

\- Android thermal conditions.



\---



\# 27. SECURITY AND GAMEPLAY INTEGRITY



\## 27.1. Offline Integrity



The initial game does not require authentication.



However, local save data must be validated before use.



\## 27.2. Reward Integrity



Reward calculations must be centralized.



A battle must not grant rewards more than once.



\## 27.3. Configuration Integrity



Battle configurations must be validated before initialization.



Invalid component references and ability configurations must be rejected.



\## 27.4. Future Online Integrity



Future online progression must use server-side validation for competitive rewards and progression.



Client-side visual state must never be considered authoritative proof of a competitive result.



\---



\# 28. DEVELOPMENT CONVENTIONS



\## 28.1. Naming



Use consistent C# naming:



\- PascalCase for types and public members.

\- camelCase for private fields and local variables.

\- Interfaces prefixed with I.

\- Constants in PascalCase.

\- Explicitly named enums.



\## 28.2. Code Quality



Code must:



\- Have a single clear responsibility.

\- Avoid unnecessary inheritance.

\- Avoid hidden global dependencies.

\- Avoid magic numbers.

\- Use explicit configuration.

\- Validate external data.

\- Be testable.

\- Avoid unnecessary allocations in performance-sensitive paths.



\## 28.3. MonoBehaviour Responsibilities



MonoBehaviours should primarily handle:



\- Unity lifecycle integration.

\- Scene object references.

\- Physics API integration.

\- Presentation integration.



Complex business rules should remain in independently testable classes.



\## 28.4. Update Loop Responsibilities



Use the appropriate Unity lifecycle:



| Lifecycle | Responsibility |

|---|---|

| Awake | Local initialization |

| OnEnable | Subscribe to events |

| Start | Dependency-ready initialization |

| Update | Presentation and frame-based input |

| FixedUpdate | Physics-related updates |

| LateUpdate | Camera and presentation adjustments |

| OnDisable | Unsubscribe from events |

| OnDestroy | Release owned resources |



Avoid placing all gameplay logic inside Update or FixedUpdate.



\---



\# 29. TECHNICAL ACCEPTANCE CRITERIA



The architecture is considered ready for MVP production when:



1\. Static definitions are separated from runtime state.

2\. Spinning tops can be assembled from modular components.

3\. Physical properties are derived from the assembly.

4\. Physics simulation is isolated behind controlled interfaces.

5\. Rotational and linear motion are independently tracked.

6\. Collision events are normalized.

7\. Battle state transitions are validated.

8\. Tactical commands are independent of Battle Modes.

9\. Abilities use a centralized execution lifecycle.

10\. Resource systems have independent ownership.

11\. AI behavior is modular and configurable.

12\. PC and Android input use a common command model.

13\. UI does not directly control physical entities.

14\. Save data is versioned and recoverable.

15\. Content definitions are validated.

16\. Gameplay can run entirely offline.

17\. Automated tests cover critical gameplay calculations.

18\. Performance targets are measurable.

19\. Future multiplayer can be introduced through explicit boundaries.

20\. Core gameplay does not depend on a networking SDK.



\---



\# 30. IMPLEMENTATION PRIORITIES



The following order is recommended:



1\. Project bootstrap and architecture.

2\. Static definition system.

3\. Runtime spinning top model.

4\. Physical assembly.

5\. Rotational and linear simulation.

6\. Ground contact and friction.

7\. Collision processing.

8\. Stamina and stability.

9\. Battle state machine.

10\. Tactical command system.

11\. Battle Mode system.

12\. Ability execution.

13\. AI perception and decision making.

14\. Arena system.

15\. PC and Android input.

16\. Battle HUD.

17\. Progression and collection.

18\. Local persistence.

19\. Performance optimization.

20\. Final MVP integration.



Implementation should proceed through vertical slices rather than building every system in isolation before testing gameplay.



\---



\# 31. FINAL TECHNICAL DIRECTION



Spin Legends must be implemented as a modular, data-driven game with a clear separation between gameplay rules, physical simulation, autonomous behavior, application workflows, and presentation.



Unity physics provides the physical foundation.



The domain layer defines gameplay rules.



The AI layer interprets tactical objectives.



The application layer coordinates gameplay workflows.



The presentation layer communicates game state to the player.



The persistence layer protects player progression.



The architecture must remain simple enough for efficient MVP development while providing clear extension points for future content and multiplayer functionality.



\*\*End of Technical Design Document\*\*



\*\*Document:\*\* TECHNICAL\_DESIGN.md  

\*\*Version:\*\* 1.0  

\*\*Project:\*\* Spin Legends  

\*\*Related Documents:\*\* SPEC.md, GAME\_DESIGN.md, DEVELOPMENT\_ROADMAP.md

