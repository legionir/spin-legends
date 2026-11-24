# SPIN LEGENDS
## Development Roadmap (DEVELOPMENT_ROADMAP)

**Document Version:** 1.0  
**Status:** Initial Development Plan  
**Project:** Spin Legends  
**Engine:** Unity 6 LTS  
**Language:** C#  
**Platforms:** Windows PC / Android  
**Related Documents:** SPEC.md, GAME_DESIGN.md, TECHNICAL_DESIGN.md

---

# 1. DEVELOPMENT STRATEGY

## 1.1. Primary Objective

The primary objective is to develop Spin Legends through incremental, testable milestones.

The project must prioritize gameplay validation before large-scale content production.

The development process follows this sequence:

```text
Foundation
    |
    v
Physics Prototype
    |
    v
Combat Prototype
    |
    v
Playable Vertical Slice
    |
    v
MVP Production
    |
    v
Content Completion
    |
    v
Optimization
    |
    v
Release Candidate
    |
    v
Release
```

Each milestone must produce a working build or a verifiable technical deliverable.

## 1.2. Development Principles

- Validate risky systems early.
- Prioritize core gameplay over secondary features.
- Build reusable systems before producing large content collections.
- Use vertical slices to validate integration.
- Avoid implementing speculative features without gameplay evidence.
- Keep PC and Android compatibility in mind from the beginning.
- Maintain a playable build throughout development.
- Measure performance on real target hardware.
- Do not introduce multiplayer into the MVP development critical path.

## 1.3. Priority Levels

| Priority | Meaning |
|---|---|
| P0 | Critical for MVP |
| P1 | Important for MVP quality |
| P2 | Post-MVP |
| P3 | Future opportunity |

---

# 2. MVP DEFINITION

## 2.1. MVP Goal

The MVP must demonstrate the complete core gameplay loop:

**Build → Configure → Battle → Earn Rewards → Upgrade → Evolve**

Players must be able to assemble spinning tops, participate in battles, defeat AI opponents, earn rewards, and improve their equipment.

The MVP must work offline on Windows and Android.

## 2.2. MVP Content Targets

| Content | Target |
|---|---:|
| Playable Arena | 1 |
| Top Designs | 6 |
| Archetypes | 4 |
| Initial Elements | 4 |
| Mechanical Components | 24 |
| Battle Modes | 5 |
| Tactical Commands | 6 |
| Active Abilities | 12 |
| AI Opponents | 5 |
| Boss Opponents | 1 |
| Evolution Paths | 3 |
| Game Modes | 2 |

These are initial production targets, not architectural limits.

## 2.3. MVP Game Modes

The MVP includes:

1. Training.
2. Tournament.

Boss Battle is deferred to the first post-MVP content update.

A tournament final may feature a stronger opponent, but this does not require implementing the full Boss Battle system during MVP production.

## 2.4. MVP Technical Scope

Required:

- Modular equipment assembly.
- Physical spinning and movement.
- Rotational stamina.
- Collision simulation.
- Stability and wobble.
- Structural damage sufficient for Burst Finish.
- Battle state management.
- Tactical commands.
- Battle modes.
- Ability execution.
- AI opponents.
- Victory detection.
- Progression and rewards.
- Local save system.
- PC input.
- Android touch input.
- Main menu.
- Workshop.
- Collection.
- Battle HUD.
- Results screen.

## 2.5. MVP Exclusions

The following features are explicitly excluded:

- Online multiplayer.
- Ranked matchmaking.
- Global leaderboards.
- Trading.
- Guilds.
- Social systems.
- Open-world exploration.
- Machine-learning-based AI.
- Real-money purchases.
- Cloud progression synchronization.
- Advanced dual-element mechanics.

---

# 3. DEVELOPMENT PHASE OVERVIEW

| Phase | Name | Main Outcome |
|---|---|---|
| 0 | Project Foundation | Valid Unity project and architecture |
| 1 | Physics Prototype | Functional spinning and collision |
| 2 | Combat Prototype | Tactical and combat systems |
| 3 | Vertical Slice | Complete representative gameplay loop |
| 4 | Core Production | Full MVP gameplay systems |
| 5 | Content Production | Equipment, abilities, AI, and progression |
| 6 | Platform Integration | PC and Android integration |
| 7 | Optimization and QA | Stable release-quality build |
| 8 | Release Preparation | Final distribution package |

Phases may overlap when dependencies permit, but critical acceptance criteria must not be skipped.

---

# 4. PHASE 0 — PROJECT FOUNDATION

## Objective

Establish the technical foundation and development workflow.

## Tasks

### 4.1. Unity Project Setup

- [ ] Create Unity 6 LTS project.
- [ ] Configure URP.
- [ ] Configure target platforms.
- [ ] Configure project input system.
- [ ] Configure physics settings.
- [ ] Configure quality profiles.
- [ ] Configure build profiles.
- [ ] Configure version control.
- [ ] Establish asset naming conventions.

### 4.2. Architecture Setup

- [ ] Create the initial folder structure.
- [ ] Create Assembly Definition files.
- [ ] Establish module dependency rules.
- [ ] Create core interfaces.
- [ ] Create validation infrastructure.
- [ ] Create centralized logging.
- [ ] Establish configuration management.

### 4.3. Content Infrastructure

- [ ] Create ScriptableObject base definitions.
- [ ] Create stable content identifier rules.
- [ ] Create content registry.
- [ ] Implement duplicate identifier detection.
- [ ] Implement missing reference validation.
- [ ] Create initial balance configuration.

### 4.4. Application Bootstrap

- [ ] Create Bootstrap scene.
- [ ] Implement application initialization.
- [ ] Implement scene transition service.
- [ ] Implement global configuration loading.
- [ ] Implement basic error handling.

## Deliverables

- Functional Unity project.
- Valid project structure.
- Working bootstrap flow.
- Initial content definition framework.
- Automated content validation.

## Acceptance Criteria

- Project builds successfully for Windows.
- Project builds successfully for Android.
- Bootstrap initializes without errors.
- Static definitions can be loaded and validated.
- Assembly dependencies follow the architecture rules.

## Exit Gate

No gameplay production should begin until the project foundation is stable.

---

# 5. PHASE 1 — PHYSICS PROTOTYPE

## Objective

Prove that spinning tops can move, rotate, collide, lose rotational energy, and behave differently based on their physical configurations.

This is the most important technical validation phase.

## Tasks

### 5.1. Physical Entity

- [ ] Create the spinning top root prefab.
- [ ] Configure Rigidbody.
- [ ] Configure physical colliders.
- [ ] Separate physical and visual hierarchies.
- [ ] Implement physical entity initialization.
- [ ] Implement runtime physical configuration.

### 5.2. Rotational Simulation

- [ ] Implement initial angular velocity.
- [ ] Track angular velocity.
- [ ] Track moment of inertia.
- [ ] Calculate rotational energy.
- [ ] Implement rotational drag.
- [ ] Implement gradual rotational energy loss.
- [ ] Implement angular momentum monitoring.

### 5.3. Linear Movement

- [ ] Implement initial movement velocity.
- [ ] Implement movement acceleration.
- [ ] Implement steering forces.
- [ ] Implement movement damping.
- [ ] Implement movement limits.
- [ ] Validate movement behavior on different surfaces.

### 5.4. Ground Contact

- [ ] Implement ground contact detection.
- [ ] Implement surface material profiles.
- [ ] Configure friction behavior.
- [ ] Evaluate rotational energy loss from ground contact.
- [ ] Implement different Performance Driver profiles.

### 5.5. Collision Simulation

- [ ] Implement spinning top collision.
- [ ] Extract collision contact data.
- [ ] Calculate impact direction.
- [ ] Evaluate collision impulse.
- [ ] Evaluate mass influence.
- [ ] Evaluate impact geometry.
- [ ] Implement boundary collision.
- [ ] Implement Ring Out detection.

### 5.6. Stability

- [ ] Implement stability evaluation.
- [ ] Implement wobble behavior.
- [ ] Implement low-stamina instability.
- [ ] Implement recovery behavior.
- [ ] Connect stability to visual feedback.

### 5.7. Physical Configuration Experiments

Build at least six test configurations:

- [ ] Light and fast.
- [ ] Heavy and stable.
- [ ] High-grip.
- [ ] Low-friction.
- [ ] High rotational endurance.
- [ ] High-impact geometry.

## Deliverables

- Physics prototype.
- One test arena.
- Two simultaneously active spinning tops.
- Six physical configurations.
- Basic collision and stamina visualization.

## Acceptance Criteria

- Different configurations produce visibly different behavior.
- Angular velocity and linear velocity remain independent.
- Collisions produce physically meaningful reactions.
- Rotational energy decreases under expected physical conditions.
- Low rotational energy produces instability.
- Ring Out detection works reliably.
- No persistent uncontrolled physics behavior occurs.

## Exit Gate

The core physical behavior must be enjoyable and sufficiently predictable before adding complex combat mechanics.

---

# 6. PHASE 2 — COMBAT PROTOTYPE

## Objective

Transform the physical prototype into a playable combat system.

## Tasks

### 6.1. Battle State Machine

- [ ] Implement battle initialization.
- [ ] Implement Preparation phase.
- [ ] Implement Launch phase.
- [ ] Implement Combat phase.
- [ ] Implement Critical phase.
- [ ] Implement Finish phase.
- [ ] Implement Results phase.
- [ ] Implement battle termination.

### 6.2. Resource Systems

- [ ] Implement rotational stamina.
- [ ] Implement ability energy.
- [ ] Implement Resonance.
- [ ] Implement structural durability.
- [ ] Implement resource validation.
- [ ] Implement resource UI events.

### 6.3. Tactical Commands

- [ ] Implement Aggressive.
- [ ] Implement Defensive.
- [ ] Implement Chase.
- [ ] Implement Circle.
- [ ] Implement Evade.
- [ ] Implement Conserve Energy.
- [ ] Implement command commitment.
- [ ] Implement command interruption rules.
- [ ] Implement command validation.

### 6.4. Battle Modes

- [ ] Implement Attack Mode.
- [ ] Implement Defense Mode.
- [ ] Implement Speed Mode.
- [ ] Implement Stamina Mode.
- [ ] Implement Berserk Mode.
- [ ] Implement mode switching.
- [ ] Implement mode costs.
- [ ] Implement cooldowns.
- [ ] Implement mode-specific modifiers.

### 6.5. Combat Outcomes

- [ ] Implement Spin Finish.
- [ ] Implement Ring Out.
- [ ] Implement Burst Finish.
- [ ] Implement result validation.
- [ ] Implement tie-breaking rules where required.

### 6.6. AI Prototype

- [ ] Implement opponent perception.
- [ ] Implement basic behavior selection.
- [ ] Implement movement objectives.
- [ ] Implement pursuit behavior.
- [ ] Implement evasion behavior.
- [ ] Implement attack behavior.
- [ ] Implement energy conservation.
- [ ] Implement basic AI difficulty.

## Deliverables

- Playable combat prototype.
- Two AI-controlled spinning tops.
- Functional tactical command system.
- Five battle modes.
- Three victory conditions.

## Acceptance Criteria

- Both participants can complete battles autonomously.
- Tactical commands produce noticeable behavior changes.
- Battle Modes create distinguishable performance differences.
- Resource consumption follows configured rules.
- Victory conditions are detected consistently.
- AI can complete battles without manual intervention.

## Exit Gate

The combat prototype must be enjoyable without progression, rewards, or large content collections.

---

# 7. PHASE 3 — VERTICAL SLICE

## Objective

Create a complete, representative gameplay experience using production-quality presentation.

The Vertical Slice must demonstrate the entire core gameplay loop.

## Tasks

### 7.1. Representative Content

- [ ] Create one polished arena.
- [ ] Create two production-quality spinning tops.
- [ ] Create twelve representative components.
- [ ] Implement two elemental identities.
- [ ] Implement four representative abilities.
- [ ] Create two AI personalities.

### 7.2. Equipment Workshop

- [ ] Implement component selection.
- [ ] Implement equipment preview.
- [ ] Implement attribute comparison.
- [ ] Implement configuration validation.
- [ ] Implement configuration saving.
- [ ] Implement equipment replacement.

### 7.3. Battle Presentation

- [ ] Implement battle HUD.
- [ ] Implement stamina indicators.
- [ ] Implement energy indicators.
- [ ] Implement Resonance indicator.
- [ ] Implement ability controls.
- [ ] Implement tactical command controls.
- [ ] Implement Battle Mode controls.
- [ ] Implement battle notifications.

### 7.4. Visual Effects

- [ ] Implement spinning trails.
- [ ] Implement collision sparks.
- [ ] Implement elemental effects.
- [ ] Implement ability effects.
- [ ] Implement wobble presentation.
- [ ] Implement Burst Finish presentation.
- [ ] Implement victory presentation.

### 7.5. Audio

- [ ] Implement spinning audio.
- [ ] Implement collision audio.
- [ ] Implement impact audio.
- [ ] Implement ability audio.
- [ ] Implement victory audio.
- [ ] Connect spinning sound to angular velocity.

### 7.6. Results and Progression

- [ ] Implement battle results screen.
- [ ] Implement reward calculation.
- [ ] Implement basic experience.
- [ ] Implement level progression.
- [ ] Implement local save and reload.

## Deliverables

A complete playable vertical slice containing:

- Main menu.
- Workshop.
- Equipment configuration.
- Battle.
- Results.
- Rewards.
- Persistent progression.

## Acceptance Criteria

- A new player can understand the gameplay loop.
- The player can configure a spinning top.
- The player can complete a battle.
- Rewards are granted correctly.
- Progression persists after restarting the game.
- Visual and audio feedback communicate important gameplay events.
- The experience is functional with both keyboard and touch input at a basic level.

## Exit Gate

The vertical slice must be reviewed before large-scale content production begins.

---

# 8. PHASE 4 — CORE GAMEPLAY PRODUCTION

## Objective

Implement the complete MVP gameplay systems.

## Tasks

### 8.1. Equipment System

- [ ] Implement all six component categories.
- [ ] Implement component compatibility.
- [ ] Implement physical property calculation.
- [ ] Implement attribute modifier calculation.
- [ ] Implement rarity definitions.
- [ ] Implement component upgrades.
- [ ] Implement equipment presets.
- [ ] Implement configuration validation.

### 8.2. Archetypes

- [ ] Implement Attacker.
- [ ] Implement Defender.
- [ ] Implement Balance.
- [ ] Implement Stamina.
- [ ] Configure initial archetype profiles.
- [ ] Validate archetype differentiation.

### 8.3. Elemental System

- [ ] Implement four MVP elements.
- [ ] Implement elemental passive effects.
- [ ] Implement elemental interactions.
- [ ] Implement status effects required by MVP abilities.
- [ ] Implement elemental resistance.
- [ ] Validate elemental balance.

### 8.4. Ability System

- [ ] Implement four ability categories.
- [ ] Implement ability slots.
- [ ] Implement ability lifecycle.
- [ ] Implement cooldown management.
- [ ] Implement resource consumption.
- [ ] Implement reusable effect definitions.
- [ ] Implement ability validation.
- [ ] Implement twelve MVP abilities.

### 8.5. Structural Damage

- [ ] Implement component durability.
- [ ] Implement collision-based damage.
- [ ] Implement damage thresholds.
- [ ] Implement component failure.
- [ ] Implement Burst Finish conditions.
- [ ] Implement structural visual feedback.

### 8.6. AI Production

- [ ] Implement configurable AI personalities.
- [ ] Implement utility-based decision scoring.
- [ ] Implement behavior priorities.
- [ ] Implement opponent evaluation.
- [ ] Implement ability usage.
- [ ] Implement boundary awareness.
- [ ] Implement difficulty settings.
- [ ] Create five AI opponents.

## Deliverables

- Complete MVP combat systems.
- Full equipment assembly.
- Four initial elements.
- Twelve abilities.
- Five AI opponents.
- Configurable structural damage.

## Acceptance Criteria

- All equipment categories influence gameplay.
- All MVP abilities work through the shared execution system.
- AI personalities are distinguishable.
- Equipment combinations create meaningful strategic differences.
- Structural damage and Burst Finish work reliably.
- Gameplay systems remain independently testable.

---

# 9. PHASE 5 — CONTENT PRODUCTION

## Objective

Create the initial production content.

## Tasks

### 9.1. Spinning Top Content

- [ ] Create six top definitions.
- [ ] Create distinct visual identities.
- [ ] Configure archetype profiles.
- [ ] Configure elemental identities.
- [ ] Create component compatibility rules.

### 9.2. Mechanical Components

- [ ] Create six Spirit Cores.
- [ ] Create six Attack Blades.
- [ ] Create four Armor Rings.
- [ ] Create four Weight Discs.
- [ ] Create two Performance Drivers.
- [ ] Create two Energy Modules.

Total target: 24 components.

The component distribution may be adjusted based on gameplay needs.

### 9.3. Arena

- [ ] Complete Neon Stadium.
- [ ] Implement arena geometry.
- [ ] Implement boundary rules.
- [ ] Configure ground material.
- [ ] Implement lighting.
- [ ] Implement camera constraints.
- [ ] Optimize arena rendering.

### 9.4. Evolution

- [ ] Implement three evolution paths.
- [ ] Implement evolution requirements.
- [ ] Implement evolution resource costs.
- [ ] Implement visual transformations.
- [ ] Implement attribute changes.
- [ ] Implement evolution validation.

### 9.5. Tournament Content

- [ ] Implement tournament structure.
- [ ] Create opponent progression.
- [ ] Implement qualification rules.
- [ ] Implement match progression.
- [ ] Implement tournament rewards.
- [ ] Implement tournament persistence.

### 9.6. Content Integration

- [ ] Validate all identifiers.
- [ ] Validate all references.
- [ ] Validate all prefabs.
- [ ] Validate all ability definitions.
- [ ] Validate all evolution paths.
- [ ] Validate all progression requirements.

## Deliverables

- Complete initial content collection.
- Six spinning top designs.
- Twenty-four components.
- Three evolution paths.
- One complete tournament.
- One production-ready arena.

## Acceptance Criteria

- All content loads successfully.
- No duplicate content identifiers exist.
- All configurations are valid.
- Every top has a recognizable gameplay identity.
- All evolution paths are achievable.
- Tournament progression persists correctly.

---

# 10. PHASE 6 — GAME MODES AND PROGRESSION INTEGRATION

## Objective

Complete the player-facing gameplay loop.

## Tasks

### 10.1. Training Mode

- [ ] Implement training setup.
- [ ] Implement opponent selection.
- [ ] Implement training configuration.
- [ ] Implement repeatable test battles.
- [ ] Implement optional diagnostic visualization.

### 10.2. Tournament Mode

- [ ] Implement tournament entry.
- [ ] Implement match progression.
- [ ] Implement opponent selection.
- [ ] Implement tournament completion.
- [ ] Implement reward distribution.
- [ ] Implement tournament recovery after application restart.

### 10.3. Collection

- [ ] Implement owned top management.
- [ ] Implement component inventory.
- [ ] Implement equipment configuration.
- [ ] Implement ability loadouts.
- [ ] Implement configuration presets.
- [ ] Implement team selection.

### 10.4. Progression

- [ ] Implement experience rewards.
- [ ] Implement top levels.
- [ ] Implement upgrade resources.
- [ ] Implement component upgrades.
- [ ] Implement evolution.
- [ ] Implement unlockable content.
- [ ] Implement player statistics.

### 10.5. Economy

- [ ] Implement Gold.
- [ ] Implement Metal Shards.
- [ ] Implement Energy Crystals.
- [ ] Implement Elemental Essence.
- [ ] Implement Evolution Tokens.
- [ ] Implement Legendary Fragments.
- [ ] Implement reward validation.
- [ ] Prevent duplicate reward grants.

## Deliverables

- Complete Training Mode.
- Complete Tournament Mode.
- Complete collection system.
- Complete initial progression loop.
- Persistent local economy.

## Acceptance Criteria

- Players can access all MVP game modes.
- All rewards are granted correctly.
- Tournament progress is preserved.
- Inventory changes are validated.
- Progression does not create impossible or negative resource states.

---

# 11. PHASE 7 — UI AND PLATFORM INTEGRATION

## Objective

Deliver complete interfaces and platform-specific input behavior.

## Tasks

### 11.1. Main Menu

- [ ] Implement main menu.
- [ ] Implement navigation.
- [ ] Implement settings.
- [ ] Implement profile access.
- [ ] Implement exit behavior.

### 11.2. Workshop

- [ ] Implement 3D spinning top preview.
- [ ] Implement component selection.
- [ ] Implement equipment comparison.
- [ ] Implement attribute presentation.
- [ ] Implement ability configuration.
- [ ] Implement configuration saving.

### 11.3. Collection

- [ ] Implement owned top list.
- [ ] Implement equipment details.
- [ ] Implement component inventory.
- [ ] Implement sorting and filtering.
- [ ] Implement team configuration.

### 11.4. Battle HUD

- [ ] Implement participant status.
- [ ] Implement stamina bars.
- [ ] Implement energy indicators.
- [ ] Implement Resonance meter.
- [ ] Implement Battle Mode selection.
- [ ] Implement tactical commands.
- [ ] Implement ability controls.
- [ ] Implement cooldown presentation.
- [ ] Implement event notifications.

### 11.5. Results

- [ ] Implement winner presentation.
- [ ] Implement finish reason.
- [ ] Implement reward summary.
- [ ] Implement experience progress.
- [ ] Implement next action navigation.

### 11.6. PC Integration

- [ ] Implement keyboard bindings.
- [ ] Implement mouse interactions.
- [ ] Implement configurable controls.
- [ ] Implement resolution settings.
- [ ] Implement graphics settings.
- [ ] Validate windowed and fullscreen modes.

### 11.7. Android Integration

- [ ] Implement touch controls.
- [ ] Implement responsive UI.
- [ ] Implement mobile safe areas.
- [ ] Implement pause and resume.
- [ ] Implement background handling.
- [ ] Implement Android save path.
- [ ] Validate different screen ratios.
- [ ] Validate touch responsiveness.

## Deliverables

- Complete UI.
- PC input configuration.
- Android touch interface.
- Integrated application navigation.

## Acceptance Criteria

- All main workflows are accessible.
- Controls work reliably on both platforms.
- Important battle information remains readable.
- UI does not interfere with simulation.
- Application handles pause and resume safely.

---

# 12. PHASE 8 — AUDIO, VISUAL QUALITY, AND POLISH

## Objective

Improve the overall presentation without compromising gameplay readability or performance.

## Tasks

### 12.1. Visual Polish

- [ ] Refine spinning top materials.
- [ ] Refine arena lighting.
- [ ] Refine collision effects.
- [ ] Refine elemental effects.
- [ ] Refine ability presentation.
- [ ] Refine Burst Finish.
- [ ] Refine evolution presentation.
- [ ] Refine camera transitions.

### 12.2. Audio Polish

- [ ] Add unique spinning sound profiles.
- [ ] Add collision variations.
- [ ] Add material-specific impact sounds.
- [ ] Add ability sound profiles.
- [ ] Add environmental audio.
- [ ] Add tournament audio.
- [ ] Add victory and defeat feedback.

### 12.3. Gameplay Feedback

- [ ] Improve stamina feedback.
- [ ] Improve stability feedback.
- [ ] Improve damage feedback.
- [ ] Improve command feedback.
- [ ] Improve ability availability feedback.
- [ ] Improve battle event notifications.

### 12.4. Accessibility and Usability

- [ ] Implement UI scaling.
- [ ] Support readable text sizes.
- [ ] Avoid relying on color alone.
- [ ] Provide configurable audio levels.
- [ ] Provide configurable camera sensitivity.
- [ ] Provide control customization where practical.

## Deliverables

- Production-quality presentation.
- Integrated audio.
- Refined gameplay feedback.
- Usability improvements.

## Acceptance Criteria

- Important combat events are understandable.
- Visual effects do not obscure the battle.
- Audio communicates meaningful state changes.
- Performance remains within platform targets.

---

# 13. PHASE 9 — OPTIMIZATION AND QUALITY ASSURANCE

## Objective

Prepare a stable release candidate.

## Tasks

### 13.1. Functional Testing

- [ ] Test all gameplay systems.
- [ ] Test all component combinations.
- [ ] Test all abilities.
- [ ] Test all battle modes.
- [ ] Test all tactical commands.
- [ ] Test all victory conditions.
- [ ] Test progression.
- [ ] Test tournament completion.

### 13.2. Persistence Testing

- [ ] Test first-time save creation.
- [ ] Test repeated saving.
- [ ] Test application interruption.
- [ ] Test corrupted save recovery.
- [ ] Test schema migration.
- [ ] Test missing content references.
- [ ] Test duplicate reward prevention.

### 13.3. Physics Testing

- [ ] Test high-speed collisions.
- [ ] Test low-speed collisions.
- [ ] Test repeated boundary impacts.
- [ ] Test extreme mass differences.
- [ ] Test low-stamina behavior.
- [ ] Test long battle sessions.
- [ ] Test unstable configurations.
- [ ] Test collision tunneling.

### 13.4. AI Testing

- [ ] Test all personalities.
- [ ] Test all difficulty levels.
- [ ] Test ability usage.
- [ ] Test evasive behavior.
- [ ] Test boundary avoidance.
- [ ] Test low-energy decisions.
- [ ] Test unusual arena positions.

### 13.5. Platform Testing

- [ ] Test Windows build.
- [ ] Test Android build.
- [ ] Test Android application lifecycle.
- [ ] Test multiple resolutions.
- [ ] Test different GPU capabilities.
- [ ] Test low-memory conditions.
- [ ] Test thermal performance.

### 13.6. Performance Optimization

- [ ] Profile physics.
- [ ] Profile AI.
- [ ] Profile rendering.
- [ ] Profile memory.
- [ ] Optimize expensive calculations.
- [ ] Optimize asset loading.
- [ ] Reduce unnecessary allocations.
- [ ] Validate frame-time stability.

## Deliverables

- QA report.
- Performance report.
- Bug tracking summary.
- Release candidate build.

## Acceptance Criteria

- No known critical gameplay defects.
- No known data-loss defects.
- No persistent simulation failures.
- Stable performance on reference hardware.
- All required MVP workflows pass testing.

---

# 14. PHASE 10 — RELEASE PREPARATION

## Objective

Prepare the final Windows and Android releases.

## Tasks

### 14.1. Release Configuration

- [ ] Configure product metadata.
- [ ] Configure application icons.
- [ ] Configure splash screen.
- [ ] Configure build identifiers.
- [ ] Configure version numbering.
- [ ] Configure production quality settings.
- [ ] Remove development-only diagnostics.

### 14.2. Final Builds

- [ ] Generate Windows release build.
- [ ] Generate Android release build.
- [ ] Validate installation.
- [ ] Validate first launch.
- [ ] Validate save creation.
- [ ] Validate offline operation.
- [ ] Validate application updates.

### 14.3. Documentation

- [ ] Prepare installation instructions.
- [ ] Prepare minimum system requirements.
- [ ] Prepare known limitations.
- [ ] Prepare release notes.
- [ ] Prepare internal troubleshooting guide.

### 14.4. Release Approval

- [ ] Complete final regression testing.
- [ ] Review critical bugs.
- [ ] Verify all acceptance criteria.
- [ ] Verify build integrity.
- [ ] Approve release candidate.

## Deliverables

- Windows release package.
- Android release package.
- Release notes.
- Installation documentation.
- Final QA report.

---

# 15. MILESTONE DEPENDENCIES

The development sequence must respect critical dependencies.

```text
Project Foundation
       |
       v
Physics Prototype
       |
       v
Combat Prototype
       |
       v
Vertical Slice
       |
       v
Core Gameplay Production
       |
       +------------------+
       |                  |
       v                  v
Content Production   Progression Systems
       |                  |
       +--------+---------+
                |
                v
        Platform Integration
                |
                v
           Polish and QA
                |
                v
           Release Candidate
                |
                v
              Release
```

Parallel development is allowed where dependencies are clear.

Examples:

- Art production can begin after the initial physical dimensions and attachment points are established.
- UI prototyping can begin during combat development.
- Audio prototyping can begin during the vertical slice.
- Additional AI personalities can be developed after the basic behavior framework is stable.

However, production content must not depend on unvalidated core systems.

---

# 16. RISK MANAGEMENT

## 16.1. Physics Complexity

**Risk:** Physical behavior may become unstable, unpredictable, or difficult to balance.

Mitigation:

- Build a dedicated physics prototype.
- Test physical configurations early.
- Use simplified collision geometry.
- Centralize physical calculations.
- Maintain reproducible test scenarios.
- Profile physics continuously.

## 16.2. Mobile Performance

**Risk:** Physics, AI, and visual effects may exceed mobile hardware capabilities.

Mitigation:

- Test Android early.
- Establish performance budgets.
- Limit unnecessary rigidbodies.
- Optimize colliders.
- Schedule AI decisions.
- Use scalable visual quality settings.

## 16.3. Combat Complexity

**Risk:** Tactical commands, battle modes, abilities, and physical simulation may create difficult interactions.

Mitigation:

- Keep commands and modes independent.
- Use explicit priority rules.
- Centralize effect execution.
- Define resource ownership.
- Test combinations systematically.

## 16.4. Content Production Cost

**Risk:** Producing many components and abilities before gameplay is validated may create rework.

Mitigation:

- Complete the vertical slice first.
- Validate reusable content definitions.
- Create representative content before full collections.
- Use data-driven balancing.

## 16.5. Scope Expansion

**Risk:** Additional modes, multiplayer, and progression features may delay the MVP.

Mitigation:

- Maintain explicit MVP exclusions.
- Require acceptance criteria for scope changes.
- Move noncritical features to post-MVP.
- Track dependencies and impact.

## 16.6. Physics and Multiplayer Compatibility

**Risk:** Local physics behavior may not be suitable for competitive network simulation.

Mitigation:

- Keep gameplay rules separate from physics execution.
- Capture simulation state.
- Separate input commands from simulation state.
- Avoid assumptions about cross-platform deterministic physics.
- Validate networking requirements before selecting the final multiplayer model.

## 16.7. Content Balance

**Risk:** Equipment combinations may create dominant strategies.

Mitigation:

- Track battle statistics.
- Use automated configuration testing.
- Test representative matchups.
- Monitor extreme attribute combinations.
- Maintain centralized balance configuration.

---

# 17. DEVELOPMENT WORKFLOW

## 17.1. Task Structure

Every development task should contain:

- Task ID.
- Title.
- Description.
- Priority.
- Dependencies.
- Expected output.
- Acceptance criteria.
- Testing requirements.
- Status.

## 17.2. Task Statuses

Recommended statuses:

```text
Backlog
Ready
In Progress
In Review
Testing
Blocked
Done
```

A task must not be marked Done merely because its code has been written.

It must satisfy its acceptance criteria.

## 17.3. Definition of Ready

A task is Ready when:

- Its purpose is clear.
- Its dependencies are identified.
- Required data structures are known.
- Acceptance criteria are documented.
- No critical design decision remains unresolved.

## 17.4. Definition of Done

A task is Done when:

- Implementation is complete.
- Relevant tests pass.
- Integration is verified.
- No known critical defects remain.
- Documentation is updated where necessary.
- Acceptance criteria are satisfied.

## 17.5. Integration Strategy

Integrate continuously.

Avoid large isolated development branches that remain disconnected for extended periods.

Every significant feature must be tested in the integrated game.

---

# 18. QUALITY GATES

Each major phase must pass a quality gate.

| Gate | Required Validation |
|---|---|
| G0 | Project builds and initializes |
| G1 | Physical simulation is stable |
| G2 | Combat systems operate correctly |
| G3 | Complete vertical slice is playable |
| G4 | All MVP gameplay systems are integrated |
| G5 | Content definitions are valid |
| G6 | PC and Android workflows are complete |
| G7 | Performance and QA requirements pass |
| G8 | Release package is verified |

A failed quality gate must be resolved before dependent production work proceeds.

---

# 19. POST-MVP ROADMAP

After the initial release, development may continue through structured content and feature updates.

## Update 1 — Expanded Combat

- Boss Battle mode.
- Counter Battle Mode.
- Additional tactical commands.
- More abilities.
- Advanced structural damage.
- Additional AI personalities.

## Update 2 — Expanded Content

- Additional arenas.
- Additional spinning tops.
- More mechanical components.
- Additional elemental identities.
- Dual-element support.
- More evolution branches.

## Update 3 — Advanced Progression

- Advanced tournaments.
- Survival Mode.
- Additional challenges.
- Expanded progression.
- Cosmetic customization.

## Update 4 — Multiplayer Foundation

- Network architecture validation.
- Network battle prototype.
- State synchronization.
- Authoritative battle validation.
- Connection handling.

## Update 5 — Competitive Multiplayer

- Friendly Battles.
- Matchmaking.
- Ranked Battles.
- Competitive rules.
- Seasonal progression.
- Leaderboards.

These updates are strategic opportunities, not commitments to a fixed release schedule.

---

# 20. PRODUCTION METRICS

Development progress must be measured using verifiable outcomes.

## 20.1. Gameplay Metrics

- Average battle duration.
- Battle completion rate.
- Average collision frequency.
- Spin Finish frequency.
- Ring Out frequency.
- Burst Finish frequency.
- AI win rate.
- Equipment configuration diversity.

## 20.2. Technical Metrics

- Average FPS.
- Frame-time consistency.
- Physics simulation cost.
- AI processing cost.
- Memory usage.
- Loading duration.
- Save reliability.
- Crash frequency.

## 20.3. Player Experience Metrics

Where playtesting is available:

- Time to understand controls.
- Workshop completion time.
- Battle comprehension.
- Ability usage frequency.
- Tactical command usage.
- Progression engagement.
- Player retention during testing.

Metrics should support design decisions rather than become goals that encourage artificial behavior.

---

# 21. ESTIMATION AND SCHEDULING

## 21.1. Estimation Strategy

Exact development duration should not be committed before the physics prototype and vertical slice are validated.

The highest-risk systems are:

- Physical simulation.
- Collision behavior.
- Autonomous movement.
- Combat balancing.
- Cross-platform performance.

These systems must be validated before creating a reliable production estimate.

## 21.2. Estimation Units

Tasks should be estimated using relative effort.

Recommended scale:

| Size | Meaning |
|---|---|
| XS | Very small, isolated task |
| S | Small implementation |
| M | Moderate feature |
| L | Complex feature |
| XL | Large feature requiring decomposition |

XL tasks must be split into smaller deliverables before implementation.

## 21.3. Scheduling Rule

A milestone is complete only when its deliverables and acceptance criteria are satisfied.

Calendar time alone must never be used as proof of completion.

---

# 22. FINAL MVP RELEASE CHECKLIST

## Core Gameplay

- [ ] Spinning physics works.
- [ ] Linear movement works.
- [ ] Collision simulation works.
- [ ] Rotational stamina works.
- [ ] Stability and wobble work.
- [ ] Structural damage works.
- [ ] Victory conditions work.

## Combat

- [ ] Six tactical commands work.
- [ ] Five battle modes work.
- [ ] Twelve abilities work.
- [ ] Resource management works.
- [ ] AI opponents work.
- [ ] Battle state transitions work.

## Content

- [ ] Six spinning top designs exist.
- [ ] Twenty-four components exist.
- [ ] Four archetypes exist.
- [ ] Four initial elements exist.
- [ ] Three evolution paths exist.
- [ ] One arena is complete.
- [ ] Five AI opponents are configured.

## Game Modes

- [ ] Training Mode works.
- [ ] Tournament Mode works.
- [ ] Tournament rewards work.
- [ ] Progression persists.

## Application

- [ ] Main menu works.
- [ ] Workshop works.
- [ ] Collection works.
- [ ] Battle HUD works.
- [ ] Results screen works.
- [ ] Settings work.
- [ ] Local saving works.

## Platforms

- [ ] Windows build works.
- [ ] Android build works.
- [ ] Keyboard and mouse work.
- [ ] Touch input works.
- [ ] Application lifecycle is stable.
- [ ] Offline operation is verified.

## Quality

- [ ] Critical tests pass.
- [ ] Performance targets are verified.
- [ ] No known critical data-loss issues remain.
- [ ] No known critical gameplay defects remain.
- [ ] Release documentation is complete.

---

# 23. FINAL DEVELOPMENT PRINCIPLE

Spin Legends must be developed around a validated and continuously playable core.

The project should not attempt to build a large collection of spinning tops, abilities, arenas, and progression systems before its physical combat foundation is proven.

The development priority is:

1. Make spinning feel physically convincing.
2. Make collisions meaningful.
3. Make autonomous movement understandable.
4. Make tactical decisions impactful.
5. Make equipment customization meaningful.
6. Make progression rewarding.
7. Make the complete experience stable across platforms.

The final product should be built through measurable milestones, controlled scope, continuous integration, and explicit acceptance criteria.

**Build the core correctly. Validate it early. Expand it systematically.**

---

**End of Development Roadmap**

**Document:** DEVELOPMENT_ROADMAP.md  
**Version:** 1.0  
**Project:** Spin Legends  
**Related Documents:** SPEC.md, GAME_DESIGN.md, TECHNICAL_DESIGN.md