\# SPIN LEGENDS

\## Game Design Document (GAME\_DESIGN)



\*\*Document Version:\*\* 1.0  

\*\*Status:\*\* Initial Game Design  

\*\*Related Document:\*\* SPEC.md  

\*\*Project:\*\* Spin Legends  

\*\*Genre:\*\* 3D Physics-Driven Strategic Arena Combat  

\*\*Platforms:\*\* Windows PC / Android



\---



\# 1. GAME DESIGN OVERVIEW



\## 1.1. Design Philosophy



Spin Legends is built around the idea that every spinning top is a customizable mechanical combat unit with its own physical characteristics, combat identity, and strategic possibilities.



The player does not directly steer the spinning top continuously.



Instead, spinning tops operate autonomously through a combination of physical simulation and behavioral intelligence. Players influence their behavior through tactical commands, combat modes, and special abilities.



The gameplay experience must reward:



\- Understanding equipment characteristics.

\- Building effective component combinations.

\- Recognizing opponent behavior.

\- Selecting appropriate combat strategies.

\- Managing rotational stamina and energy.

\- Timing special abilities.

\- Adapting to changing battle conditions.



The game must avoid becoming a simple comparison of numerical attributes.



A weaker spinning top with a well-designed configuration and better tactical decisions must have a reasonable opportunity to defeat a stronger opponent.



\## 1.2. Core Gameplay Principles



\### Physics Determines Possibilities



Physical characteristics determine how a spinning top behaves.



\### AI Determines Execution



Autonomous behavior determines how the spinning top interprets its current objective.



\### Player Determines Strategy



The player selects combat modes, tactical commands, and abilities.



\### Equipment Determines Identity



Components influence physical behavior, performance, and available strategic options.



\### Progression Expands Possibilities



Upgrades and evolution introduce new configurations and gameplay opportunities.



\---



\# 2. SPINNING TOP DESIGN



\## 2.1. Mechanical Architecture



Every spinning top consists of six primary components:



1\. Spirit Core

2\. Attack Blade

3\. Armor Ring

4\. Weight Disc

5\. Performance Driver

6\. Energy Module



Each component contributes to the overall characteristics of the assembled spinning top.



Components must not be treated as independent numerical bonuses only.



Their physical geometry, mass, material properties, and interaction with other components should influence the resulting behavior.



\## 2.2. Spirit Core



The Spirit Core defines the identity of the spinning top.



Responsibilities:



\- Base attributes.

\- Elemental affinity.

\- Passive abilities.

\- Special ability compatibility.

\- Evolution identity.

\- Base energy characteristics.



The Spirit Core may also determine which evolutionary paths are available.



\### Core Properties



| Property | Description |

|---|---|

| Base Attack | Initial offensive capability |

| Base Defense | Initial defensive capability |

| Base Stamina | Initial rotational endurance |

| Base Stability | Initial balance characteristics |

| Element | Primary elemental affinity |

| Energy Capacity | Maximum ability energy |

| Resonance Rate | Resonance generation modifier |



\## 2.3. Attack Blade



The Attack Blade defines the primary collision geometry.



Its design must influence:



\- Contact points.

\- Impact direction.

\- Collision distribution.

\- Offensive characteristics.

\- Resistance to incoming impacts.

\- Rotational drag.



Different blade geometries should produce different collision patterns.



Examples:



| Blade Design | Intended Behavior |

|---|---|

| Sharp Contact Blade | Concentrated impacts |

| Wide Contact Blade | Broad contact surface |

| Multi-Point Blade | Multiple possible collision points |

| Curved Blade | Deflection and glancing impacts |

| Heavy Impact Blade | High-momentum collisions |



Blade geometry must be represented by actual 3D collision shapes.



Attack ratings must not replace physical collision calculations.



\## 2.4. Armor Ring



The Armor Ring protects the internal assembly and influences defensive characteristics.



Properties:



\- Structural durability.

\- Impact resistance.

\- Mass distribution.

\- Contact protection.

\- Damage resistance.



Armor damage may affect the performance of the spinning top.



\## 2.5. Weight Disc



The Weight Disc determines a significant portion of the spinning top's physical mass and mass distribution.



Properties:



\- Total mass.

\- Center of mass.

\- Moment of inertia.

\- Rotational stability.

\- Collision momentum.



A heavier spinning top generally transfers more momentum during collisions but may experience reduced acceleration and greater movement inertia.



The actual result depends on the complete physical configuration.



\## 2.6. Performance Driver



The Performance Driver defines how the spinning top interacts with the arena surface.



Properties:



\- Ground contact geometry.

\- Friction coefficient.

\- Grip.

\- Movement responsiveness.

\- Stability.

\- Energy loss.

\- Acceleration characteristics.



Driver types must produce noticeably different movement patterns.



Examples:



| Driver Type | Behavior |

|---|---|

| Flat | Aggressive movement and high mobility |

| Sharp | Stable rotation and reduced lateral movement |

| Rubber | Strong grip and increased friction |

| Ball | Smooth movement and balanced contact |

| Hybrid | Configurable balance between grip and mobility |



\## 2.7. Energy Module



The Energy Module determines the spinning top's ability-related resource characteristics.



Properties:



\- Maximum energy.

\- Energy regeneration.

\- Ability efficiency.

\- Resonance generation.

\- Elemental compatibility.



Energy Modules must not directly generate unlimited rotational stamina.



Rotational endurance and ability energy are separate systems.



\---



\# 3. ATTRIBUTE SYSTEM



\## 3.1. Primary Attributes



Every assembled spinning top has the following primary attributes:



| Attribute | Range | Description |

|---|---:|---|

| Attack | 1–100 | Offensive effectiveness |

| Defense | 1–100 | Defensive effectiveness |

| Stamina | 1–100 | Rotational endurance |

| Speed | 1–100 | Movement performance |

| Stability | 1–100 | Balance and wobble resistance |

| Control | 1–100 | Behavioral responsiveness |

| Energy | 1–100 | Ability resource capacity |

| Critical | 1–100 | Enhanced impact potential |



These values represent normalized gameplay characteristics rather than direct physical measurements.



Weight is maintained as an independent physical property.



\## 3.2. Attribute Calculation



The final attribute values are calculated from:



\- Core properties.

\- Component properties.

\- Upgrade bonuses.

\- Evolution modifiers.

\- Applicable passive abilities.



A basic attribute calculation model:



```text

FinalAttribute =

&#x20;   CoreBase

&#x20;   + ComponentContributions

&#x20;   + UpgradeBonuses

&#x20;   + EvolutionModifiers

&#x20;   + PassiveModifiers

```



The final result must be clamped to the allowed attribute range.



Component contributions must be configurable.



Different component categories may contribute to multiple attributes.



\## 3.3. Archetype Profiles



Archetypes define preferred attribute distributions.



They do not impose strict equipment restrictions.



Initial archetype profiles:



| Archetype | Attack | Defense | Stamina | Speed | Stability |

|---|---:|---:|---:|---:|---:|

| Attacker | 90 | 40 | 45 | 85 | 45 |

| Defender | 45 | 90 | 70 | 35 | 90 |

| Balance | 65 | 65 | 65 | 65 | 65 |

| Stamina | 40 | 55 | 95 | 50 | 80 |



These values represent initial design targets and should be adjusted through gameplay testing.



\## 3.4. Attribute Trade-Offs



No component should provide unrestricted advantages.



Examples:



\- Increasing weight may improve collision momentum while reducing acceleration.

\- Increasing grip may improve directional control while increasing energy loss.

\- Increasing attack geometry may introduce greater rotational drag.

\- Increasing armor may improve structural resistance while increasing mass.

\- Increasing speed may reduce stability under certain conditions.



Trade-offs should emerge from actual physics whenever possible.



\---



\# 4. PHYSICS-DRIVEN COMBAT



\## 4.1. Physical Simulation Model



Each spinning top must be represented as an independent physical entity.



The simulation must track:



```text

Position

Rotation

Linear Velocity

Angular Velocity

Mass

Moment of Inertia

Center of Mass

Ground Contact

Stability

Rotational Energy

Structural Integrity

```



Movement and collision behavior must emerge from physical interactions rather than predefined attack animations.



\## 4.2. Two Independent Motion Systems



Spinning tops have two different motion dimensions.



\### Linear Motion



Movement across the arena surface.



Important variables:



\- Position.

\- Linear velocity.

\- Acceleration.

\- Friction.

\- Ground reaction forces.



\### Rotational Motion



Rotation around the spinning top's central axis.



Important variables:



\- Angular velocity.

\- Angular momentum.

\- Moment of inertia.

\- Rotational drag.

\- Gyroscopic stability.



These systems must remain conceptually and technically independent.



A spinning top may have high rotational speed but low movement speed.



It may also move rapidly while gradually losing rotational energy.



\## 4.3. Rotational Motion



Angular momentum is calculated as:



\\\[

L = I\\omega

\\]



Where:



\- \\(L\\) is angular momentum.

\- \\(I\\) is moment of inertia.

\- \\(\\omega\\) is angular velocity.



Moment of inertia depends on mass distribution.



This means two spinning tops with identical total mass may exhibit different rotational behavior.



\## 4.4. Rotational Energy



Rotational kinetic energy:



\\\[

E\_r = \\frac{1}{2}I\\omega^2

\\]



Rotational energy decreases due to:



\- Ground friction.

\- Mechanical resistance.

\- Collision losses.

\- Environmental interactions.

\- Ability-related effects.



The simulation must avoid reducing stamina through arbitrary fixed timers alone.



\## 4.5. Stamina Model



Stamina represents the remaining effective rotational endurance.



It must be derived from rotational energy and normalized for gameplay presentation.



A basic model:



```text

NormalizedStamina =

&#x20;   CurrentRotationalEnergy / InitialRotationalEnergy

```



The displayed stamina percentage should be smoothed for readability.



Stamina loss should depend on:



\- Driver friction.

\- Rotational drag.

\- Collision intensity.

\- Ground contact.

\- Structural damage.

\- Active battle modes.



\## 4.6. Ground Friction



Friction must influence both movement and rotational energy consumption.



A simplified friction model:



\\\[

F\_f = \\mu N

\\]



Where:



\- \\(\\mu\\) is the friction coefficient.

\- \\(N\\) is the normal force.



Different drivers and arena materials must produce different friction characteristics.



\## 4.7. Collision System



Collisions are one of the most important gameplay mechanics.



The collision system must consider:



\- Relative velocity.

\- Mass.

\- Contact position.

\- Surface geometry.

\- Collision angle.

\- Rotational state.

\- Impact direction.

\- Structural resistance.



A simplified normal collision impulse:



\\\[

J =

\\frac{-(1+e)v\_n}

{\\frac{1}{m\_1}+\\frac{1}{m\_2}}

\\]



Where:



\- \\(J\\) is the collision impulse magnitude.

\- \\(e\\) is the coefficient of restitution.

\- \\(v\_n\\) is relative velocity along the collision normal.

\- \\(m\_1\\) and \\(m\_2\\) are the effective masses.



Actual collision behavior must account for angular velocity, contact points, and rotational inertia.



\## 4.8. Collision Classification



Collisions may be classified for gameplay and presentation purposes.



| Collision Type | Description |

|---|---|

| Direct Impact | Strong frontal contact |

| Glancing Impact | Contact with partial deflection |

| Side Impact | Contact from the side |

| Rear Impact | Contact from behind |

| Rebound | Contact followed by separation |

| Critical Impact | Exceptional impact event |

| Boundary Impact | Collision with arena boundaries |



Classification must be based on physical collision information.



\## 4.9. Stability and Wobble



A spinning top must gradually lose stability as rotational energy decreases.



Stability is influenced by:



\- Angular momentum.

\- Mass distribution.

\- Center of mass.

\- Ground contact.

\- Collision impulses.

\- Driver geometry.



When stability becomes low:



\- The spinning top begins wobbling.

\- Ground contact becomes less consistent.

\- Friction may increase.

\- Rotational energy loss may accelerate.

\- Movement becomes less predictable.



A spinning top must not remain perfectly upright until its stamina reaches zero.



\## 4.10. Gyroscopic Effects



Rotational motion should influence the spinning top's resistance to changes in orientation.



The simulation should account for gyroscopic behavior where practical.



High angular momentum should generally make rapid orientation changes more difficult.



This behavior must be physically plausible and must not produce uncontrollable movement.



\## 4.11. Arena Boundaries



Arena geometry must physically constrain movement.



Boundary collisions must consider:



\- Impact direction.

\- Velocity.

\- Mass.

\- Surface material.

\- Contact geometry.



Some arenas may contain special boundary mechanisms.



Ring Out detection must use actual arena boundaries rather than visual position alone.



\---



\# 5. BATTLE FLOW



\## 5.1. Battle State Machine



Every battle must follow a controlled state sequence.



```text

Idle

&#x20; |

&#x20; v

Preparation

&#x20; |

&#x20; v

Launch

&#x20; |

&#x20; v

Combat

&#x20; |

&#x20; +------> Critical

&#x20; |          |

&#x20; |          v

&#x20; +------> Combat

&#x20; |

&#x20; v

Finish

&#x20; |

&#x20; v

Results

&#x20; |

&#x20; v

Rewards

```



Transitions must be controlled by explicit conditions.



\## 5.2. Preparation Phase



Players configure:



\- Active spinning top.

\- Equipment.

\- Ability slots.

\- Initial battle mode.

\- Preferred tactical behavior.



The system must validate the selected configuration before launching.



\## 5.3. Launch Phase



The launch determines the initial physical conditions.



Launch parameters include:



\- Initial angular velocity.

\- Initial movement velocity.

\- Initial movement direction.

\- Launch accuracy.

\- Initial stability.



The launch system must support meaningful player interaction.



Launch quality should influence initial conditions but must not determine the entire battle.



\## 5.4. Combat Phase



During combat:



\- Both spinning tops move autonomously.

\- Physical collisions are continuously evaluated.

\- Stamina decreases.

\- Tactical commands influence AI behavior.

\- Battle modes modify performance.

\- Abilities may be activated.

\- Arena conditions may change.



\## 5.5. Critical Phase



The Critical Phase represents a high-risk battle situation.



It may be triggered when:



\- A spinning top reaches a low stamina threshold.

\- Structural integrity becomes critical.

\- A major collision occurs.

\- A special battle condition is activated.



Critical Phase must introduce increased visual and audio feedback.



It must not automatically grant unfair advantages.



\## 5.6. Finish Phase



The battle must immediately stop accepting normal combat commands after a valid finish condition is confirmed.



The result must be determined by the battle rules and validated physical state.



\---



\# 6. TACTICAL COMMAND SYSTEM



\## 6.1. Command Philosophy



Tactical commands define the intended behavior of a spinning top.



They do not directly control its position.



The autonomous behavior system interprets commands and converts them into movement objectives and physical forces.



Commands must remain active for a configurable duration unless interrupted by a higher-priority event.



\## 6.2. Initial Tactical Commands



The full command system includes:



\### Aggressive



Prioritize opponent engagement.



Behavior:



\- Reduce unnecessary distance.

\- Seek collision opportunities.

\- Favor offensive positioning.

\- Accept higher collision risk.



\### Defensive



Prioritize survival and stability.



Behavior:



\- Avoid unfavorable engagements.

\- Maintain safe positioning.

\- Reduce unnecessary movement.

\- Favor stable trajectories.



\### Chase



Actively pursue the opponent.



Behavior:



\- Estimate opponent position.

\- Calculate an interception target.

\- Adjust movement direction.

\- Recalculate pursuit as the opponent moves.



\### Circle



Move around the opponent while maintaining a configurable distance.



Behavior:



\- Calculate an orbital target.

\- Maintain circular movement.

\- Avoid direct approach where possible.

\- Create opportunities for angled attacks.



\### Evade



Prioritize collision avoidance.



Behavior:



\- Predict incoming movement.

\- Identify dangerous trajectories.

\- Select an alternative movement direction.

\- Temporarily increase defensive priority.



\### Hold Position



Maintain a designated strategic area.



Behavior:



\- Minimize unnecessary displacement.

\- Resist unwanted movement.

\- Reposition when forced by physical interactions.



\### Counter



Prepare for an incoming attack.



Behavior:



\- Monitor opponent approach.

\- Preserve stability.

\- Favor defensive positioning.

\- Execute a counterattack when suitable conditions occur.



\### Conserve Energy



Reduce unnecessary energy consumption.



Behavior:



\- Avoid excessive acceleration.

\- Reduce unnecessary engagement.

\- Prefer efficient movement.

\- Preserve rotational endurance.



\## 6.3. MVP Command Selection



The initial playable version must implement:



1\. Aggressive

2\. Defensive

3\. Chase

4\. Circle

5\. Evade

6\. Conserve Energy



The remaining commands may be introduced after the core combat system is validated.



\## 6.4. Command Priority



Commands must support priority levels.



Suggested priority order:



```text

Emergency Avoidance

&#x20;   |

Counter Execution

&#x20;   |

Active Tactical Command

&#x20;   |

Default Archetype Behavior

&#x20;   |

Idle Behavior

```



This hierarchy must be configurable.



\## 6.5. Command Commitment



Commands should not change every frame.



Each command must define:



\- Minimum execution duration.

\- Maximum execution duration.

\- Cooldown.

\- Interruption conditions.

\- Priority.

\- Energy implications.



Emergency reactions may interrupt normal command execution.



\## 6.6. Command Effectiveness



Command effectiveness must depend on:



\- Control attribute.

\- Current stability.

\- Movement speed.

\- Current physical state.

\- Opponent behavior.

\- Available movement space.



A spinning top with low stability should have reduced ability to execute precise movement commands.



\---



\# 7. BATTLE MODE SYSTEM



\## 7.1. Mode Philosophy



Battle Modes define temporary combat configurations.



They modify the behavior and priorities of the spinning top without replacing its underlying physical characteristics.



Battle Modes must be distinct from Tactical Commands.



A Battle Mode defines how the spinning top performs.



A Tactical Command defines what it currently tries to accomplish.



\## 7.2. Attack Mode



Primary purpose: Increase offensive performance.



Effects:



\- Increased offensive priority.

\- More aggressive movement patterns.

\- Higher collision engagement.

\- Increased impact opportunities.

\- Higher rotational energy consumption.



Trade-offs:



\- Reduced defensive priority.

\- Greater exposure to counterattacks.

\- Increased rotational energy loss.



\## 7.3. Defense Mode



Primary purpose: Improve survivability.



Effects:



\- Increased stability priority.

\- Reduced structural damage.

\- More defensive positioning.

\- Improved resistance to unfavorable collisions.



Trade-offs:



\- Reduced offensive opportunities.

\- Lower movement aggression.

\- Potentially longer battle duration.



\## 7.4. Speed Mode



Primary purpose: Improve mobility.



Effects:



\- Increased acceleration.

\- Improved movement responsiveness.

\- More frequent repositioning.

\- Better pursuit capabilities.



Trade-offs:



\- Increased friction losses.

\- Reduced stability under certain conditions.

\- Greater risk of losing control near boundaries.



\## 7.5. Stamina Mode



Primary purpose: Improve rotational endurance.



Effects:



\- Reduced unnecessary movement.

\- Lower energy consumption.

\- More efficient movement patterns.

\- Reduced rotational energy loss from selected gameplay modifiers.



Trade-offs:



\- Reduced aggressive engagement.

\- Lower burst mobility.

\- Fewer offensive opportunities.



\## 7.6. Counter Mode



Primary purpose: Improve defensive reactions and counterattacks.



Effects:



\- Increased prediction priority.

\- Improved defensive positioning.

\- Better response to incoming attacks.

\- Increased counterattack opportunities.



Trade-offs:



\- Requires appropriate opponent behavior.

\- May be ineffective against evasive opponents.

\- Reduces direct offensive pressure.



\## 7.7. Berserk Mode



Primary purpose: Temporarily increase offensive performance.



Effects:



\- Increased offensive priority.

\- Enhanced collision aggression.

\- Increased impact modifiers.

\- Enhanced visual and audio presentation.



Trade-offs:



\- Rapid energy consumption.

\- Reduced defensive behavior.

\- Increased stability risk.

\- Temporary recovery period after activation.



Berserk must be a high-risk decision rather than an automatic winning ability.



\## 7.8. Mode Switching Rules



The mode system must define:



\- Activation cost.

\- Cooldown.

\- Duration where applicable.

\- Transition time.

\- Cancellation conditions.

\- Mode-specific modifiers.



Only one primary Battle Mode may be active at a time.



Mode switching must not instantly restore stamina or reset physical state.



\## 7.9. Mode and Command Interaction



Battle Modes and Tactical Commands must operate independently.



Examples:



```text

Attack Mode + Chase

Attack Mode + Evade

Defense Mode + Hold Position

Defense Mode + Circle

Speed Mode + Chase

Stamina Mode + Conserve Energy

Counter Mode + Evade

Berserk Mode + Aggressive

```



The final behavior must be calculated by combining mode priorities with command objectives.



\---



\# 8. ABILITY SYSTEM



\## 8.1. Ability Categories



Abilities are divided into four categories:



1\. Elemental

2\. Defensive

3\. Tactical

4\. Ultimate



Every spinning top supports four configurable ability slots.



\## 8.2. Ability Properties



Every ability must define:



```text

ID

Name

Description

Category

Element

Energy Cost

Resonance Cost

Cooldown

Activation Duration

Effect Duration

Power

Range

Target Requirements

Activation Conditions

Visual Effect

Audio Effect

```



Not every ability requires every property.



\## 8.3. Ability Execution



Abilities must follow a controlled lifecycle:



```text

Available

&#x20;  |

&#x20;  v

Activation Requested

&#x20;  |

&#x20;  v

Validate Conditions

&#x20;  |

&#x20;  v

Consume Resources

&#x20;  |

&#x20;  v

Execute Ability

&#x20;  |

&#x20;  v

Apply Effects

&#x20;  |

&#x20;  v

Complete

&#x20;  |

&#x20;  v

Cooldown

&#x20;  |

&#x20;  v

Available

```



Invalid activation requests must not consume resources.



\## 8.4. Elemental Abilities



Initial elemental ability examples:



\### Fire



\- Flame Burst

\- Burning Trail

\- Inferno Dash



\### Water



\- Aqua Pulse

\- Energy Flow

\- Tidal Shield



\### Ice



\- Frost Impact

\- Ice Barrier

\- Frozen Field



\### Lightning



\- Thunder Dash

\- Chain Shock

\- Electric Surge



\### Earth



\- Stone Guard

\- Ground Impact

\- Fortress Pulse



\### Wind



\- Cyclone Dash

\- Wind Deflection

\- Vortex Strike



\### Shadow



\- Shadow Veil

\- Energy Drain

\- Phantom Strike



\### Light



\- Radiant Shield

\- Purification

\- Solar Burst



These abilities are design concepts and must be balanced through testing.



\## 8.5. Ability Effects



Abilities may influence:



\- Physical movement.

\- Collision characteristics.

\- Rotational energy.

\- Stability.

\- Structural integrity.

\- Opponent movement.

\- Opponent energy.

\- Environmental conditions.



Direct damage effects should be used only where appropriate.



Abilities should interact with the underlying physics system rather than replacing it with scripted outcomes.



\## 8.6. Ultimate Abilities



Ultimate abilities represent powerful special actions.



They require sufficient Resonance.



They must include:



\- Distinct activation feedback.

\- A clear activation window.

\- A meaningful effect.

\- Appropriate counterplay.

\- A cooldown or resource limitation.



Ultimate abilities must not guarantee victory.



\---



\# 9. RESONANCE SYSTEM



\## 9.1. Purpose



Resonance represents combat momentum and the synchronization between a spinning top and its core.



It is a separate resource from rotational stamina and ability energy.



\## 9.2. Resonance Generation



Resonance may be generated through:



\- Successful collisions.

\- Effective defensive actions.

\- Successful counters.

\- Skillful evasions.

\- Successful ability usage.

\- Surviving critical situations.



\## 9.3. Resonance Modifiers



Resonance generation may depend on:



\- Action effectiveness.

\- Relative opponent strength.

\- Collision quality.

\- Ability timing.

\- Current battle conditions.



Repeated low-value actions must not generate unlimited Resonance.



\## 9.4. Ultimate Activation



An Ultimate ability becomes available when the Resonance meter reaches its required threshold.



The system must prevent:



\- Repeated activation without sufficient resources.

\- Activation after battle termination.

\- Invalid activation during incompatible states.



\---



\# 10. ELEMENTAL SYSTEM



\## 10.1. Elemental Identity



Elements provide unique combat characteristics.



Elements must influence abilities, passive effects, visual presentation, and selected gameplay interactions.



Elemental properties must remain secondary to physical configuration and tactical execution.



\## 10.2. Elemental Interactions



Initial elemental relationships:



| Element | Strong Against | Weak Against |

|---|---|---|

| Fire | Ice, Wind | Water, Earth |

| Water | Fire, Earth | Lightning, Ice |

| Ice | Wind, Earth | Fire, Lightning |

| Lightning | Water, Wind | Earth |

| Earth | Lightning, Fire | Water, Wind |

| Wind | Earth, Shadow | Ice, Lightning |

| Shadow | Light, Water | Light, Wind |

| Light | Shadow | Shadow, Earth |



The relationship table is an initial balancing framework, not an absolute damage rule.



\## 10.3. Elemental Modifier



Elemental advantages should initially use a limited effectiveness modifier.



Suggested starting values:



```text

Elemental Advantage: +15%

Elemental Disadvantage: -10%

Neutral Interaction: 0%

```



Modifiers must be applied through defined ability and effect calculations.



They should not automatically modify every physical collision.



\## 10.4. Status Effects



The elemental system may introduce status effects:



| Status | Effect |

|---|---|

| Burn | Temporary additional energy loss |

| Slow | Reduced movement responsiveness |

| Freeze | Temporary movement limitation |

| Shock | Temporary control disruption |

| Weaken | Reduced offensive effectiveness |

| Drain | Energy reduction |

| Purify | Removes selected negative effects |



Status effects must have defined duration, strength, stacking rules, and resistance.



\## 10.5. Dual Elements



Dual-element configurations may combine two compatible elemental identities.



A dual-element configuration must define:



\- Primary element.

\- Secondary element.

\- Compatibility rules.

\- Combined passive effects.

\- Special abilities.

\- Visual identity.

\- Evolution requirements.



Dual elements must not simply combine the full advantages of both elements without additional trade-offs.



\---



\# 11. STRUCTURAL DAMAGE SYSTEM



\## 11.1. Purpose



Structural damage introduces another strategic dimension beyond rotational stamina.



A spinning top may continue rotating while its mechanical components become progressively damaged.



\## 11.2. Component Durability



Eligible components must have independent durability values.



```text

Component Durability: 0–100

```



Damage depends on:



\- Collision impulse.

\- Contact location.

\- Component material.

\- Defensive properties.

\- Existing structural condition.



\## 11.3. Damage States



| Condition | Result |

|---|---|

| 100–75% | Normal operation |

| 74–50% | Minor damage |

| 49–25% | Reduced performance |

| 24–1% | Critical damage |

| 0% | Component failure |



Damage thresholds and performance effects must be configurable.



\## 11.4. Component Failure



Component failure may cause:



\- Reduced stability.

\- Increased friction.

\- Reduced offensive effectiveness.

\- Altered movement behavior.

\- Mechanical separation.



Component failure must be visually communicated.



\## 11.5. Burst Events



Burst events occur when the assembly experiences a sufficiently severe structural failure.



Burst probability must depend on actual damage and collision conditions.



The system must not randomly destroy a healthy spinning top without a valid gameplay reason.



Burst events must be visually impressive but must not interrupt battle result validation.



\---



\# 12. VICTORY CONDITIONS



\## 12.1. Spin Finish



A spinning top loses effective rotational motion.



Requirements:



\- Angular velocity falls below a defined threshold.

\- The condition persists for a minimum validation duration.

\- The spinning top cannot recover through remaining gameplay mechanics.



\## 12.2. Ring Out



A spinning top leaves the valid arena region.



Requirements:



\- Position crosses the arena's designated boundary.

\- The condition is confirmed by the arena rules.

\- Temporary collision separation does not incorrectly trigger a Ring Out.



\## 12.3. Burst Finish



The spinning top experiences a valid structural failure.



The result is confirmed when the required assembly failure conditions are met.



\## 12.4. Knockout



A special battle rule may define a decisive impact condition.



Knockout must be explicitly configured per battle type.



\## 12.5. Survival



If the battle timer expires:



1\. Compare remaining rotational endurance.

2\. Compare structural condition.

3\. Apply configured tie-breaking rules.

4\. Declare the winner.



Tie-breaking rules must be deterministic and documented.



\---



\# 13. ARENA DESIGN



\## 13.1. Arena Architecture



Every arena must define:



\- Physical geometry.

\- Valid battle region.

\- Spawn positions.

\- Boundary characteristics.

\- Surface material.

\- Friction parameters.

\- Environmental effects.

\- Camera configuration.

\- Arena-specific rules.



\## 13.2. Initial Arenas



\### Neon Stadium



Purpose: Standard competitive environment.



Characteristics:



\- Circular battle area.

\- Balanced surface friction.

\- Standard boundaries.

\- No environmental hazards.



\### Volcanic Arena



Characteristics:



\- Heat zones.

\- Temporary hazardous regions.

\- Distinctive surface materials.

\- Fire-related environmental effects.



\### Frozen Dome



Characteristics:



\- Low-friction areas.

\- Reduced ground grip.

\- Slippery movement.

\- Ice-related environmental effects.



\### Thunder Circuit



Characteristics:



\- Electrical hazard zones.

\- Temporary energy disturbances.

\- Lightning-related environmental effects.



\### Ancient Temple



Characteristics:



\- Restricted movement regions.

\- Physical obstacles.

\- Multiple surface types.

\- Environmental interaction opportunities.



\### Shadow Dimension



Characteristics:



\- Temporary visibility disturbances.

\- Special environmental effects.

\- Altered energy interactions.



\## 13.3. Environmental Fairness



Environmental effects must:



\- Be visible before activation.

\- Have understandable behavior.

\- Avoid unpredictable instant victories.

\- Apply consistently to all participants.

\- Respect arena-specific battle rules.



\---



\# 14. AUTONOMOUS MOVEMENT AND AI



\## 14.1. AI Architecture



Each spinning top must have an autonomous behavior controller.



The controller interprets:



\- Current tactical command.

\- Active battle mode.

\- Physical state.

\- Opponent position.

\- Opponent movement.

\- Arena geometry.

\- Available abilities.

\- Current resources.



The AI converts these inputs into movement objectives.



\## 14.2. Decision-Making Pipeline



```text

Battle State

&#x20;    |

&#x20;    v

Perception System

&#x20;    |

&#x20;    v

State Evaluation

&#x20;    |

&#x20;    v

Behavior Selection

&#x20;    |

&#x20;    v

Movement Target Calculation

&#x20;    |

&#x20;    v

Steering and Force Calculation

&#x20;    |

&#x20;    v

Physics Simulation

&#x20;    |

&#x20;    v

Updated Battle State

```



\## 14.3. Behavior Selection



The initial system should use a combination of:



\- Finite State Machines.

\- Utility-based decision scoring.

\- Configurable behavior priorities.



Behavior candidates include:



\- Approach.

\- Attack.

\- Retreat.

\- Pursue.

\- Orbit.

\- Evade.

\- Stabilize.

\- Counter.

\- Conserve Energy.



\## 14.4. Utility Evaluation



Each candidate behavior receives a utility score.



A general model:



\\\[

U(b) = \\sum\_{i=1}^{n} w\_i s\_i(b)

\\]



Where:



\- \\(b\\) represents a candidate behavior.

\- \\(w\_i\\) represents the importance of a decision factor.

\- \\(s\_i\\) represents the evaluated suitability of that factor.



The selected behavior is the highest-scoring valid candidate, subject to priority and interruption rules.



\## 14.5. AI Personalities



Each opponent personality must define configurable preferences.



\### Aggressive



\- High engagement priority.

\- Frequent pursuit.

\- Higher collision risk tolerance.

\- Early offensive ability usage.



\### Defensive



\- High survival priority.

\- Reduced unnecessary engagement.

\- Increased stability preference.

\- Reactive counter behavior.



\### Tactical



\- Evaluates multiple combat options.

\- Manages abilities carefully.

\- Adjusts strategy according to battle conditions.



\### Evasive



\- Maintains distance.

\- Avoids direct collisions.

\- Prioritizes stamina preservation.



\### Adaptive



\- Changes behavior according to opponent actions.

\- Evaluates player command patterns.

\- Adjusts ability usage.



\### Heavy Assault



\- Uses mass and momentum advantages.

\- Prefers direct engagements.

\- Relies on powerful collision opportunities.



\## 14.6. AI Difficulty



Difficulty must modify decision quality.



Parameters may include:



\- Decision frequency.

\- Reaction delay.

\- Prediction accuracy.

\- Utility evaluation quality.

\- Ability timing.

\- Resource management.

\- Tactical consistency.



AI must not receive hidden physical advantages unless explicitly defined by a special battle rule.



\---



\# 15. COLLECTION AND EQUIPMENT MANAGEMENT



\## 15.1. Collection Structure



Every player may own multiple spinning tops.



Each owned spinning top must have independent progression and configuration.



\## 15.2. Team Composition



The player may configure a team of up to three spinning tops.



Only one may be active at a time.



Switching rules must define:



\- Allowed switching conditions.

\- Switching cooldown.

\- Energy implications.

\- State preservation.

\- Structural damage preservation.



\## 15.3. Configuration Presets



Players must be able to save multiple configurations.



Each preset contains:



\- Component selection.

\- Ability selection.

\- Cosmetic settings.

\- Preferred battle mode.

\- Preferred tactical behavior.



Presets must be validated before entering a battle.



\---



\# 16. PROGRESSION SYSTEM



\## 16.1. Progression Philosophy



Progression should unlock additional strategic possibilities.



Increasing numerical attributes must not be the only form of advancement.



Progression should provide:



\- New components.

\- New abilities.

\- Additional configuration options.

\- Evolution paths.

\- Cosmetic customization.

\- New challenges.



\## 16.2. Experience



Spinning tops earn experience through:



\- Completing battles.

\- Winning matches.

\- Defeating stronger opponents.

\- Completing challenges.

\- Participating in tournaments.



Experience distribution must be configurable.



\## 16.3. Level Progression



A level progression curve must be defined.



An initial experience requirement model:



\\\[

XP\_{required}(L) = B \\times L^p

\\]



Where:



\- \\(L\\) is the current level.

\- \\(B\\) is a configurable base value.

\- \\(p\\) controls progression difficulty.



The curve must avoid excessively slow early progression.



\## 16.4. Evolution



Evolution may require:



\- Minimum level.

\- Specific components.

\- Elemental resources.

\- Evolution tokens.

\- Special challenge completion.



Evolution must preserve the identity of the original spinning top.



\## 16.5. Evolution Branches



Some spinning tops may support multiple evolution paths.



Example:



```text

Base Form

&#x20;   |

&#x20;   +---- Offensive Evolution

&#x20;   |

&#x20;   +---- Defensive Evolution

&#x20;   |

&#x20;   +---- Hybrid Evolution

```



Each path must have meaningful differences in appearance, abilities, and attributes.



\---



\# 17. ECONOMY AND REWARDS



\## 17.1. Currency Types



Initial resources:



| Resource | Purpose |

|---|---|

| Gold | Standard purchases |

| Metal Shards | Mechanical upgrades |

| Energy Crystals | Energy-related upgrades |

| Elemental Essence | Elemental progression |

| Evolution Tokens | Evolution requirements |

| Legendary Fragments | Special equipment acquisition |



\## 17.2. Reward Calculation



Battle rewards should depend on:



\- Battle difficulty.

\- Completion.

\- Performance.

\- Opponent strength.

\- Challenge objectives.

\- Tournament progression.



Winning must provide meaningful rewards without making repeated farming excessively profitable.



\## 17.3. Reward Distribution



Rewards must be granted only after successful battle completion.



Interrupted battles must follow explicit reward rules.



Duplicate rewards must be prevented.



\---



\# 18. GAME MODES



\## 18.1. Training Mode



Purpose:



Allow players to test equipment and understand combat mechanics.



Features:



\- Selectable opponents.

\- Configurable opponent behavior.

\- Unlimited equipment testing.

\- Physics visualization options.

\- Ability testing.

\- No competitive ranking.



\## 18.2. Tournament Mode



Purpose:



Provide structured competitive progression.



Structure:



```text

Tournament

&#x20;   |

&#x20;   v

Qualification

&#x20;   |

&#x20;   v

Round of 16

&#x20;   |

&#x20;   v

Quarterfinal

&#x20;   |

&#x20;   v

Semifinal

&#x20;   |

&#x20;   v

Final

&#x20;   |

&#x20;   v

Champion Rewards

```



Tournament size must be configurable.



Not every tournament needs to use the same structure.



\## 18.3. Boss Battle



Boss opponents must feature unique mechanics.



Examples:



\- Unusual collision behavior.

\- Special arena interactions.

\- Multiple combat phases.

\- Unique ability combinations.

\- Special victory conditions.



Bosses must require strategy rather than simply higher attributes.



\## 18.4. Future Modes



Future content may include:



\- Survival.

\- Friendly Multiplayer.

\- Ranked Multiplayer.

\- Seasonal Tournaments.

\- Special Challenges.



\---



\# 19. BALANCING SYSTEM



\## 19.1. Balancing Philosophy



The game must avoid dominant configurations.



Every major advantage must have an understandable limitation.



\## 19.2. Attribute Trade-Offs



Examples:



| Advantage | Associated Limitation |

|---|---|

| High Weight | Lower acceleration |

| High Grip | Increased friction |

| High Attack | Reduced defensive efficiency |

| High Speed | Greater stability risk |

| High Armor | Increased mass |

| High Stamina | Reduced offensive specialization |



These are design tendencies, not mandatory mathematical relationships.



\## 19.3. Combat Balance



Combat balance must consider:



\- Equipment configuration.

\- Player skill.

\- AI behavior.

\- Elemental interactions.

\- Battle mode.

\- Tactical commands.

\- Ability effectiveness.

\- Arena characteristics.



\## 19.4. Competitive Balance



Future ranked gameplay must use normalized competitive rules where appropriate.



Potential mechanisms:



\- Level normalization.

\- Equipment power restrictions.

\- Tournament-specific loadout rules.

\- Separate competitive progression.



Competitive rules must be transparent to players.



\## 19.5. Balance Testing



Every new component and ability must be tested against representative configurations.



Testing must include:



\- Attacker versus Defender.

\- Attacker versus Stamina.

\- Defender versus Balance.

\- Heavy versus Light.

\- Elemental advantages.

\- Different arena materials.

\- Different AI personalities.



Win rates should be monitored, but win rate alone must not determine whether a configuration is balanced.



\---



\# 20. CAMERA AND PRESENTATION



\## 20.1. Battle Camera



The battle camera must maintain a clear view of both spinning tops.



Requirements:



\- Smooth tracking.

\- Automatic framing.

\- Collision awareness.

\- Boundary awareness.

\- Configurable zoom.

\- Adjustable viewing angle.



\## 20.2. Cinematic Events



Special presentation may occur during:



\- Launch.

\- Critical collisions.

\- Ultimate activation.

\- Burst events.

\- Final impacts.

\- Victory.



Cinematic presentation must not interfere with gameplay responsiveness.



\## 20.3. Player Control During Cinematics



Critical battle decisions must remain available whenever possible.



Cinematics may temporarily modify camera behavior but should not unnecessarily pause the physical simulation.



\---



\# 21. GAME FEEL AND FEEDBACK



\## 21.1. Physical Feedback



Every meaningful physical event must provide appropriate feedback.



Examples:



\- Strong collisions produce noticeable camera and audio feedback.

\- Reduced stability produces visible wobble.

\- High-speed movement produces motion trails.

\- Low stamina changes spinning behavior.

\- Structural damage changes component appearance.

\- Ability activation produces identifiable effects.



\## 21.2. Gameplay Readability



Players must be able to understand:



\- Why a collision was effective.

\- Why stamina is decreasing.

\- Why a spinning top is losing stability.

\- Why a tactical command is ineffective.

\- Why an ability cannot be activated.

\- Which environmental effects are active.



\## 21.3. Visual Priorities



Gameplay information must remain visually distinguishable from decorative effects.



Critical combat indicators must never be obscured by excessive particles or camera effects.



\---



\# 22. MULTIPLAYER GAMEPLAY DESIGN



Multiplayer is not part of the initial MVP, but the game design must remain compatible with future online battles.



\## 22.1. Battle Rules



Online battles must use the same fundamental:



\- Equipment definitions.

\- Physical rules.

\- Battle modes.

\- Tactical commands.

\- Ability definitions.

\- Victory conditions.



\## 22.2. Competitive Integrity



Ranked battles must validate:



\- Equipment configurations.

\- Ability activation.

\- Resource consumption.

\- Battle results.

\- Reward distribution.



\## 22.3. Simulation Consistency



The multiplayer architecture must account for differences between local and remote simulation.



Battle outcomes must not rely exclusively on unverified client-side results.



\## 22.4. Matchmaking



Future matchmaking may consider:



\- Competitive rank.

\- Player skill.

\- Equipment restrictions.

\- Connection quality.

\- Match availability.



\---



\# 23. MVP GAMEPLAY DEFINITION



The initial playable version must prove that the core combat experience is enjoyable.



\## 23.1. Required Features



| Feature | MVP |

|---|---|

| Physical spinning | Required |

| Linear movement | Required |

| Angular momentum | Required |

| Collision physics | Required |

| Stamina depletion | Required |

| Stability and wobble | Required |

| Modular equipment | Required |

| Four archetypes | Required |

| Four elements | Required |

| Six tactical commands | Required |

| Five battle modes | Required |

| Twelve abilities | Required |

| Basic AI | Required |

| One arena | Required |

| One boss | Required |

| Local progression | Required |

| Local saving | Required |



The five MVP battle modes are:



\- Attack

\- Defense

\- Speed

\- Stamina

\- Berserk



Counter Mode is deferred to the expanded combat implementation.



\## 23.2. MVP Victory Conditions



The initial version must implement:



\- Spin Finish.

\- Ring Out.

\- Burst Finish.



Additional victory conditions may be added later.



\## 23.3. MVP Exclusions



The initial combat implementation does not require:



\- Dual elements.

\- Advanced structural damage simulation.

\- Adaptive machine learning.

\- Multiplayer synchronization.

\- Advanced arena hazards.

\- Complex boss phase systems.



\---



\# 24. GAME DESIGN ACCEPTANCE CRITERIA



The gameplay design is considered successfully implemented when:



1\. Two spinning tops can battle autonomously.

2\. Their physical characteristics produce visibly different movement.

3\. Their mass distribution influences rotational behavior.

4\. Collisions produce meaningful physical reactions.

5\. Stamina decreases according to physical activity.

6\. Low rotational energy produces instability.

7\. Tactical commands influence movement objectives.

8\. Battle modes create distinguishable combat behavior.

9\. Abilities operate through a consistent resource system.

10\. Elemental effects introduce strategic differences.

11\. AI opponents can complete battles independently.

12\. Victory conditions are consistently detected.

13\. Equipment configurations create meaningful gameplay differences.

14\. Progression unlocks additional strategic possibilities.

15\. The game remains enjoyable without requiring constant player input.



\---



\# 25. FINAL DESIGN PRINCIPLES



The following principles must guide all gameplay implementation and future design decisions.



\- Physics must determine physical interactions.

\- AI must determine autonomous execution.

\- Player commands must determine strategic objectives.

\- Equipment must influence actual gameplay behavior.

\- Abilities must interact with existing combat systems.

\- Battle modes must introduce meaningful trade-offs.

\- Progression must expand strategic possibilities.

\- Elemental advantages must remain balanced.

\- Every major mechanic must provide understandable feedback.

\- No single attribute, component, element, or ability should dominate every situation.

\- Gameplay must remain responsive on both target platforms.

\- New content must extend existing systems rather than introduce unnecessary parallel implementations.



\---



\# 26. FINAL GAMEPLAY VISION



Spin Legends must deliver a combat experience where spinning tops feel like independent mechanical entities with recognizable personalities and physical characteristics.



Every collision should have a physical explanation.



Every tactical decision should have a potential consequence.



Every component should contribute to the identity of the assembled spinning top.



Every ability should create an opportunity rather than guarantee an outcome.



Every progression milestone should expand the player's possibilities.



The central gameplay experience must remain focused on three interconnected systems:



\*\*Build — Battle — Evolve\*\*



Players build their own spinning tops, master their combat behavior, overcome increasingly challenging opponents, and continuously develop their creations.



\---



\*\*End of Game Design Document\*\*



\*\*Document:\*\* GAME\_DESIGN.md  

\*\*Version:\*\* 1.0  

\*\*Project:\*\* Spin Legends  

\*\*Related Documents:\*\* SPEC.md, TECHNICAL\_DESIGN.md, DEVELOPMENT\_ROADMAP.md

