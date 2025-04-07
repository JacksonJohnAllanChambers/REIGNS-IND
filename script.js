// Ensure this is run after the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Loaded. Initializing script...");

    // --- Configuration ---
    // (GameSettings, ClassDefinitions, SpecialCards as before)
        const GameSettings = {
        initialClassWeights: [ // Ensure weights add up reasonably (normalization happens)
            { classId: 'laborer', weight: 65 }, // Using integers for clarity
            { classId: 'merchantile', weight: 25 },
            { classId: 'noble', weight: 10 },
            { classId: 'royalty', weight: 0 }
        ],
        statMin: 0,      // The absolute minimum value for any stat (usually 0)
        statMax: 100,    // The value at which stats might cause high-failure (fixed at 100)
    };

    const ClassDefinitions = {
        'laborer': {
            id: 'laborer',
            displayName: 'Laborer',
            statBarMax: 100, // The visual maximum of the stat bar for this class
            ascensionThreshold: { wealth: 0, reputation: 0, health: 0, stability: 0 }, // Threshold to BE this class
            nextLevelThreshold: { wealth: 65, reputation: 60, health: 60, stability: 60 }, // Threshold to LEAVE this class (upwards)
            nextClassId: 'merchantile',
            highStatFailure: { wealth: true, reputation: true, health: true, stability: true }, // Which stats hitting GameSettings.statMax (100) are fatal
            allowedCardTags: ['common', 'laborer', 'factory', 'slum', 'opportunity', 'danger', 'family', 'health'],
            initialStatRanges: {
                wealth: [30, 55], reputation: [30, 55], health: [40, 65], stability: [40, 65]
            }
        },
        'merchantile': {
            id: 'merchantile',
            displayName: 'Merchantile',
            statBarMax: 110, // Can visually represent slightly > 100
            ascensionThreshold: { wealth: 65, reputation: 60, health: 60, stability: 60 },
            nextLevelThreshold: { wealth: 85, reputation: 80, health: 75, stability: 75 }, // Increased thresholds
            nextClassId: 'noble',
            highStatFailure: { wealth: false, reputation: true, health: true, stability: true },
            allowedCardTags: ['common', 'merchantile', 'trade', 'city', 'opportunity', 'danger', 'politics'],
            initialStatRanges: {
                wealth: [55, 75], reputation: [50, 70], health: [50, 70], stability: [50, 70]
            }
        },
        'noble': {
            id: 'noble',
            displayName: 'Noble',
            statBarMax: 120, // Can visually represent more
            ascensionThreshold: { wealth: 85, reputation: 80, health: 75, stability: 75 }, // Adjusted to match merchantile's next level
            nextLevelThreshold: { wealth: 95, reputation: 95, health: 90, stability: 90 }, // High bar for overthrow trigger
            nextClassId: 'royalty', // Ascended via special card
            highStatFailure: { wealth: false, reputation: false, health: true, stability: true },
            allowedCardTags: ['common', 'noble', 'politics', 'court', 'estate', 'opportunity', 'danger', 'family'],
            initialStatRanges: {
                wealth: [70, 90], reputation: [65, 85], health: [60, 80], stability: [60, 80]
            }
        },
        'royalty': {
            id: 'royalty',
            displayName: 'Royalty',
            statBarMax: 130, // Max visual representation
            ascensionThreshold: { wealth: 95, reputation: 95, health: 90, stability: 90 }, // High bar from noble trigger
            nextLevelThreshold: null,
            nextClassId: null,
            highStatFailure: { wealth: false, reputation: false, health: true, stability: false }, // Only health fatal at 100?
            allowedCardTags: ['common', 'royalty', 'politics', 'court', 'kingdom', 'danger', 'family'],
            initialStatRanges: null // Not started here normally
        }
    };

    const SpecialCards = {
        OVERTHROW_PROMPT: 'overthrow_decision_card',
        CLASS_CHANGE_INFO: 'class_change_info_card'
    };

    // --- Master Card Definitions ---
        const allCards = [
          // --- ================= Special & Triggerable Cards ================= ---
    {
        id: SpecialCards.OVERTHROW_PROMPT, // 'overthrow_decision_card'
        tags: ['noble', 'politics', 'danger'], // Only shown to Nobles meeting threshold
        is_triggerable: true, // Requires specific conditions beyond tags/random draw
        character: "shadowy_advisor", // Character representing dangerous ambition
        image: "images/shadowy_advisor.png", // NEED IMAGE
        text: "Your power eclipses shadows cast by the throne. Many powerful figures quietly support a... change. Will you seize the crown?",
        choice_left_text: "Seize the Crown", // -> Become Royalty (via special handling)
        effect_left: {}, // No direct stat change, handled by applyChoice special logic
        choice_right_text: "Remain Loyal", // -> Loyalty Death (via special handling)
        effect_right: {}, // No direct stat change, handled by applyChoice special logic
    },
    {
        id: SpecialCards.CLASS_CHANGE_INFO, // 'class_change_info_card'
        tags: ['common'], // Technically applies to anyone changing class
        is_follow_up: true, // Only appears when triggered by changeClass()
        character: "spirit_guide", // Your non-human guide
        image: "images/spirit_guide.png", // NEED IMAGE
        text: "The threads of fate reweave. Your station is now [Class Name]. Walk this new path.", // Text dynamically updated
        effect_consequence: { health: +5, stability: +5 }, // Small morale boost on change
        choice_left_text: "Adapt",
        effect_left: {},
        choice_right_text: "Adapt",
        effect_right: {}
    },
    {
        // Triggered specifically on failure of overthrow attempt (would need logic modification or just trigger the death directly)
        id: "overthrow_failed_info", // Placeholder if needed before death card
        is_follow_up: true,
        tags: ['noble', 'politics', 'danger'],
        character: "royal_guard",
        image: "images/royal_guard.png", // NEED IMAGE
        text: "Your plot unravels! Guards storm your chambers!",
        effect_consequence: { stability: -50, reputation: -50 }, // Drastic immediate consequence
        choice_left_text: "Resist!", // -> Leads to death anyway usually
        effect_left: { next_card_id: "overthrow_failed_death" },
        choice_right_text: "Surrender...", // -> Leads to death anyway
        effect_right: { next_card_id: "overthrow_failed_death" }
    },

    {
        id: "game_start_info", // Unique ID for the intro card
        tags: ['common', 'intro'], // Tags might not be strictly needed if always first
        is_follow_up: true, // Treat it like a follow-up so it doesn't get drawn randomly
        character: "spirit_guide",
        image: "images/spirit_guide.png", // Use the guide image
        text: "You flicker into existence as a [Class Name]. Born into soot/trade/silk. Make your mark.", // Dynamic text placeholder
        effect_consequence: { stability: +5 }, // Small starting nudge? Optional.
        choice_left_text: "Begin",
        effect_left: {}, // No stat changes needed, handled by applyChoice logic
        choice_right_text: "Begin",
        effect_right: {}
    },
    // --- ================= Follow-up Chain Examples ================= ---
    // --- Investment Chain ---
    {
        id: "investor_opportunity",
        tags: ['common', 'opportunity', 'laborer', 'merchantile', 'city'],
        character: "inventor_artisan",
        image: "images/inventor_artisan.png",
        text: "An eccentric inventor needs investors for a 'labour-saving' device, promising huge returns.",
        choice_left_text: "Dismiss as folly",
        effect_left: { stability: +5 },
        choice_right_text: "Invest savings",
        effect_right: { wealth: -25, stability: -10, next_card_id: "investor_wait_period" }
    },
    {
        id: "investor_wait_period",
        tags: ['common', 'opportunity'], // Context matches chain
        is_follow_up: true,
        character: "calendar_page", // Representing time passing
        image: "images/calendar_page.png", // NEED IMAGE
        text: "Weeks turn into months. No word from the inventor. Was it a scam?",
        effect_consequence: { health: -5, stability: -5 }, // Stress
        choice_left_text: "Worry", // Only one outcome from here (could randomize success/fail later)
        effect_left: { next_card_id: "investor_outcome_success" }, // Link to success outcome for now
        choice_right_text: "Worry",
        effect_right: { next_card_id: "investor_outcome_success" } // Link to success outcome
        // ALT: effect_right: { next_card_id: "investor_outcome_failure" } // For random failure
    },
    {
        id: "investor_outcome_success",
        tags: ['common', 'opportunity'], // Context matches chain
        is_follow_up: true,
        character: "inventor_artisan",
        image: "images/inventor_artisan.png",
        text: "Success! The invention works beyond wildest dreams! You receive a massive return.",
        effect_consequence: { wealth: +75, reputation: +10, stability: +15 }, // Big payoff!
        choice_left_text: "Astonishing!",
        effect_left: {},
        choice_right_text: "Astonishing!",
        effect_right: {}
    },
    // { // Optional Failure Outcome
    //     id: "investor_outcome_failure",
    //     tags: ['common', 'opportunity', 'danger'],
    //     is_follow_up: true,
    //     character: "empty_workshop", image: "images/empty_workshop.png", // NEED IMAGE
    //     text: "The inventor vanished. The workshop is empty. Your savings are gone.",
    //     effect_consequence: { wealth: -10, reputation: -10, stability: -15 }, // Loss confirmed, not just the investment amount gone
    //     choice_left_text: "Curses!",
    //     effect_left: {},
    //     choice_right_text: "Curses!",
    //     effect_right: {}
    // },

    // --- Foreman Informing Chain ---
    {
        id: "theft_rumor_foreman", // Renamed slightly from generic theft rumor
        tags: ['laborer', 'factory', 'danger', 'opportunity'],
        character: "weary_worker",
        image: "images/weary_worker.png",
        text: "Mary whispers the Foreman pockets scrapped materials. Informing Sterling is risky.",
        choice_left_text: "Inform Sterling",
        effect_left: { reputation: +5, stability: -5, next_card_id: "inform_outcome" }, // Minimal direct, outcome is next
        choice_right_text: "Ignore it",
        effect_right: { reputation: -5, stability: +5 } // Safer, slightly complicit
    },
    {
        id: "inform_outcome",
        tags: ['laborer', 'factory', 'danger', 'opportunity'], // Context match
        is_follow_up: true,
        character: "factory_owner",
        image: "images/factory_owner.png",
        text: "Sterling listens, eyes narrowed. 'Loyalty is valued. We will observe.' He gives you a small purse.",
        effect_consequence: { wealth: +10, reputation: -15, stability: -15 }, // Reward, peer distrust, foreman is enemy
        choice_left_text: "Leave nervously",
        effect_left: {},
        choice_right_text: "Leave nervously",
        effect_right: {}
    },

    // --- Strike Chain ---
    {
        id: "strike_call",
        tags: ['laborer', 'union', 'factory', 'danger', 'politics'], // Union activity is inherently political
        character: "union_organizer",
        image: "images/union_organizer.png",
        text: "The strike begins tomorrow! For solidarity and better wages! Join the line or cross it?",
        choice_left_text: "Join the Strike",
        effect_left: { reputation: +15, stability: -15, next_card_id: "strike_day_1" },
        choice_right_text: "Cross the Line",
        effect_right: { wealth: +10, reputation: -25, stability: +5, next_card_id: "strike_scab_confrontation" }
    },
    {
        id: "strike_day_1",
        tags: ['laborer', 'union', 'factory', 'danger', 'politics'], // Context match
        is_follow_up: true,
        character: "picket_line", // Scene image
        image: "images/picket_line.png", // NEED IMAGE
        text: "Cold dawn on the picket line. Hunger gnaws. Police watch intently. Solidarity keeps spirits up... barely.",
        effect_consequence: { wealth: -10, health: -5, stability: -10 }, // Cost of striking (lost pay)
        choice_left_text: "Hold the line!", // Could lead to more strike events
        effect_left: { reputation: +5 }, // Holding firm adds rep
        choice_right_text: "Hold the line!",
        effect_right: { reputation: +5 }
    },
    {
        id: "strike_scab_confrontation",
        tags: ['laborer', 'factory', 'danger'], // Context match
        is_follow_up: true,
        character: "angry_workers", // Scene image
        image: "images/angry_workers.png", // NEED IMAGE
        text: "Faces harden as you walk towards the factory gates. 'Scab!' 'Traitor!' Someone throws mud.",
        effect_consequence: { reputation: -15, stability: -5 }, // Immediate social consequence
        choice_left_text: "Ignore them",
        effect_left: {},
        choice_right_text: "Ignore them",
        effect_right: {}
    },


    // --- ================= Standard Laborer Cards ================= ---
    {   id: "overtime_offer",
        tags: ['laborer', 'factory', 'opportunity'],
        character: "factory_owner",
        image: "images/factory_owner.png",
        text: "Mandatory overtime for a rush order! Sterling promises a bonus.",
        choice_left_text: "Refuse (Risky)",
        effect_left: { reputation: +5, health: +5, stability: -10 },
        choice_right_text: "Accept (Exhausting)",
        effect_right: { wealth: +10, reputation: -5, health: -15, stability: +5 }
    },
     {   id: "rent_demand_laborer", // Specific version? Or keep generic rent_demand tag okay?
        tags: ['laborer', 'slum', 'common'],
        character: "slum_landlord",
        image: "images/slum_landlord.png",
        text: "Rent's due NOW! The landlord threatens eviction.",
        choice_left_text: "Plead poverty",
        effect_left: { reputation: -10, stability: -15 },
        choice_right_text: "Pay (If possible)",
        effect_right: { wealth: -15, stability: +10 }
    },
    {  id: "laborer_secret_meeting",
        tags: ['laborer', 'union', 'factory', 'danger', 'politics'],
        character: "union_organizer",
        image: "images/union_organizer.png",
        text: "A secret union meeting tonight. Discussing demands. Attendance is risky.",
        choice_left_text: "Attend",
        effect_left: { reputation: +15, health: -5, stability: -20 },
        choice_right_text: "Avoid It",
        effect_right: { reputation: -10, stability: +10 }
    },
    {   id: "spy_offer_factory",
        tags: ['laborer', 'factory', 'danger', 'opportunity'],
        character: "factory_foreman",
        image: "images/factory_foreman.png",
        text: "The Foreman offers easier work if you report any 'troublemakers'.",
        choice_left_text: "Refuse Loyalty",
        effect_left: { reputation: +10, health: -5 },
        choice_right_text: "Agree to Watch",
        effect_right: { wealth: +5, reputation: -15, health: +10, stability: +5 }
    },
    {   id: "new_machine_skill",
        tags: ['laborer', 'factory', 'opportunity'],
        character: "factory_owner",
        image: "images/factory_owner.png",
        text: "Learn the new, faster machine? Higher pay, fewer jobs overall.",
        choice_left_text: "Learn Skill",
        effect_left: { wealth: +10, reputation: -5, health: -5, stability: +5 },
        choice_right_text: "Stick to Old Ways",
        effect_right: { reputation: +5, stability: -10 } // Job insecurity rises
    },
     {  id: "sick_coworker",
         tags: ['laborer', 'factory', 'common', 'health'],
         character: "weary_worker",
         image: "images/weary_worker.png",
         text: "A coworker collapses from illness but fears being fired.",
         choice_left_text: "Help them discretely",
         effect_left: { reputation: +10, health: -5, stability: -10 }, // Risk attention
         choice_right_text: "Alert the Foreman",
         effect_right: { reputation: -10, stability: +5 } // Seen as cold
     },
      {  id: "begging_child_slums",
         tags: ['laborer', 'slum', 'common', 'family'],
         character: "child_worker",
         image: "images/child_worker.png",
         text: "A ragged child begs for a crust of bread.",
         choice_left_text: "Share your meagre food",
         effect_left: { wealth: -5, reputation: +10 },
         choice_right_text: "Harden your heart",
         effect_right: { reputation: -10, health: -5 } // Small mental toll?
     },
      { id: "smog_pollution",
         tags: ['laborer', 'slum', 'city', 'common', 'health', 'danger'],
         character: "smoggy_sky", image:"images/smoggy_sky.png", // NEED IMAGE
         text: "The air is thick with coal smoke today. Your lungs ache.",
         choice_left_text: "Cover face with cloth",
         effect_left: { health: +5 }, // Minor protection
         choice_right_text: "Endure it",
         effect_right: { health: -10 } // Constant damage
     },
     { id: "cholera_scare_common",
        tags: ['laborer', 'slum', 'city', 'common', 'health', 'danger'],
        character: "water_pump", image:"images/water_pump.png", // NEED IMAGE
        text: "Cholera outbreak! The local water pump is suspect. Boil water?",
        choice_left_text: "Risk Pump Water",
        effect_left: { health: -30, stability: -15 }, // High risk
        choice_right_text: "Boil Water (Costly)",
        effect_right: { wealth: -10, health: +10, stability: +5 }
    },
    { id: "spouse_ill_laborer",
        tags: ['laborer', 'family', 'health', 'common'],
        character: "sick_family_member", image: "images/sick_family_member.png", // NEED IMAGE
        text: "Your spouse is too ill to work. You're the sole earner now.",
        choice_left_text: "Work double shifts",
        effect_left: { wealth: +5, health: -25, stability: -10 }, // Exhaustion
        choice_right_text: "Seek charity/loans",
        effect_right: { wealth: +10, reputation: -15, stability: -15 } // Debt/shame
    },
    { id: "found_coin_laborer",
        tags: ['laborer', 'slum', 'common', 'opportunity'],
        character: "dropped_coin", image: "images/dropped_coin.png", // NEED IMAGE
        text: "You spot a dropped shilling on the grimy street!",
        choice_left_text: "Pocket it quickly",
        effect_left: { wealth: +10, reputation: -5 },
        choice_right_text: "Give to poor box/Look for owner",
        effect_right: { reputation: +10 }
    },

    {   id: "foreman_pressure",
        tags: ['laborer', 'factory', 'danger'],
        character: "factory_foreman",
        image: "images/factory_foreman.png", // Correct
        text: "The Foreman demands you speed up production, ignoring safety.",
        choice_left_text: "Work Faster (Risky)",
        effect_left: { wealth: +5, health: -10, stability: -5 }, // Small bonus, risk injury
        choice_right_text: "Maintain Safe Pace",
        effect_right: { reputation: -5, stability: +5 } // Safer, foreman unhappy
    },
    {   id: "layoff_rumors",
        tags: ['laborer', 'factory', 'common', 'danger'],
        character: "weary_worker",
        image: "images/weary_worker.png", // Correct
        text: "Whispers of layoffs circulate. Workers are anxious.",
        choice_left_text: "Worry Quietly",
        effect_left: { stability: -10, health: -5 }, // Internal stress
        choice_right_text: "Ask Foreman (Bold)",
        effect_right: { reputation: +5, stability: -15 } // Seen as bold or troublemaker
    },
    {   id: "minor_malfunction",
        tags: ['laborer', 'factory', 'danger', 'opportunity'],
        character: "broken_machine", // Character reflects situation
        image: "images/broken_machine.png", // Correct
        text: "Your machine sputters. A quick fix might work, but reporting it means downtime.",
        choice_left_text: "Try Quick Fix",
        effect_left: { health: -5, stability: -5 }, // Risk failure/injury (Could add random failure -> worse outcome later)
        choice_right_text: "Report to Foreman",
        effect_right: { wealth: -5, reputation: +5 } // Lose potential pay, seem responsible
    },
    {   id: "short_pay",
        tags: ['laborer', 'factory', 'common', 'danger'],
        character: "factory_owner", // Or Foreman
        image: "images/factory_owner.png", // Correct
        text: "Payday arrives, but your wage seems short. Questioning it could cause trouble.",
        choice_left_text: "Demand Correct Pay",
        effect_left: { reputation: +10, stability: -10 }, // Stand up, risk backlash
        choice_right_text: "Accept Silently",
        effect_right: { wealth: -5, reputation: -5, stability: +5 } // Lose money, seem weak
    },
    {   id: "neighbor_in_need",
        tags: ['laborer', 'slum', 'common', 'family'],
        character: "weary_worker", // Represents neighbor
        image: "images/weary_worker.png", // Correct
        text: "Your neighbor's child is sick, they ask to borrow a few pennies for medicine.",
        choice_left_text: "Share What Little You Have",
        effect_left: { wealth: -5, reputation: +10, stability: +5 }, // Community spirit
        choice_right_text: "Politely Refuse",
        effect_right: { reputation: -10, stability: -5 } // Necessary harshness?
    },
    {   id: "suspicious_alley_figure",
        tags: ['laborer', 'slum', 'danger'],
        character: "shadowy_figure", // Generic name
        image: "images/slum_alley.png", // Correct
        text: "A cloaked figure lurks in the alley near your tenement late at night.",
        choice_left_text: "Investigate Cautiously",
        effect_left: { health: -10, stability: -5 }, // Risk confrontation
        choice_right_text: "Bolt Your Door",
        effect_right: { stability: +5 } // Safer option
    },
    {   id: "tenement_infestation",
        tags: ['laborer', 'slum', 'common', 'health', 'danger'],
        character: "slum_landlord",
        image: "images/slum_landlord.png", // Correct
        text: "Rats are becoming bolder in the tenement walls. Complaining might raise rent.",
        choice_left_text: "Complain to Landlord",
        effect_left: { reputation: +5, stability: -10 }, // Might achieve nothing, annoys landlord
        choice_right_text: "Set Crude Traps",
        effect_right: { wealth: -5, health: +5 } // Spend meagre resources for minor health benefit
    },
    {   id: "cheap_gin_offer",
        tags: ['laborer', 'slum', 'common'],
        character: "weary_worker", // Offering the drink
        image: "images/slum_alley.png", // Setting
        text: "After a long shift, a neighbor offers a swig of cheap, potent gin to numb the aches.",
        choice_left_text: "Accept a Drink",
        effect_left: { wealth: -2, health: -8, stability: +10 }, // Tiny cost, health hit, temp stability boost
        choice_right_text: "Decline Politely",
        effect_right: { health: +2, stability: -2 } // Small health benefit, slight stability dip from refusing solace?
    },
    {   id: "injured_worker_fund",
        tags: ['laborer', 'union', 'factory', 'common', 'family'],
        character: "union_organizer",
        image: "images/union_organizer.png", // Correct
        text: "A collection is being taken for Tim, badly injured by a machine. Can you spare anything?",
        choice_left_text: "Contribute Generously",
        effect_left: { wealth: -10, reputation: +15, stability: +5 }, // Significant cost, big rep boost
        choice_right_text: "Offer Empty Sympathy",
        effect_right: { reputation: -10 } // Seen as uncaring
    },
    {   id: "union_strategy_debate",
        tags: ['laborer', 'union', 'factory', 'politics', 'danger'],
        character: "union_organizer",
        image: "images/angry_workers.png", // Correct
        text: "At the union meeting: Argue for immediate strike action, or cautious negotiation?",
        choice_left_text: "Demand Strike Now!",
        effect_left: { reputation: +10, stability: -15 }, // Seen as radical, increases tension
        choice_right_text: "Counsel Negotiation",
        effect_right: { reputation: -5, stability: +10 } // Seen as moderate/weak, less tension
    },
    {   id: "crackdown_whispers",
        tags: ['laborer', 'union', 'factory', 'politics', 'danger'],
        character: "weary_worker",
        image: "images/police_baton.png", // Hint of danger
        text: "Whispers suggest the police are planning to raid the next union gathering.",
        choice_left_text: "Warn Everyone Discreetly",
        effect_left: { reputation: +10, stability: -10 }, // Helps others, risks exposure
        choice_right_text: "Keep Your Head Down",
        effect_right: { reputation: -10, stability: +5 } // Safer for self, abandons comrades
    },
    {   id: "worsening_cough",
        tags: ['laborer', 'common', 'health', 'danger', 'slum', 'city'],
        character: "smoggy_sky", // Represents cause
        image: "images/smoggy_sky.png", // Correct
        text: "That cough isn't going away. Maybe see that back-alley 'doctor'?",
        choice_left_text: "Pay the Quack Doctor",
        effect_left: { wealth: -8, health: +5, stability: -5 }, // Costs money, slight *chance* of help, risk
        choice_right_text: "Endure and Hope",
        effect_right: { health: -10 } // Condition likely worsens
    },
    {   id: "food_contamination_scare",
        tags: ['laborer', 'slum', 'common', 'health', 'danger'],
        character: "water_pump", // Represents source
        image: "images/water_pump.png", // Correct
        text: "Rumors spread that the cheap meat sold by the corner vendor is tainted.",
        choice_left_text: "Risk Eating It",
        effect_left: { health: -20, stability: -10 }, // High risk of illness
        choice_right_text: "Go Hungry Tonight",
        effect_right: { wealth: -2, health: -5, stability: -5 } // Minor cost maybe (missed meal value?), hunger effect
    },
    {   id: "found_tool",
        tags: ['laborer', 'factory', 'common', 'opportunity'],
        character: "factory_foreman", // Relevant authority
        image: "images/dropped_coin.png", // Represents found object visually
        text: "You find a perfectly good wrench left behind near your station.",
        choice_left_text: "Keep It Quietly",
        effect_left: { wealth: +3, reputation: -5 }, // Small gain, slightly dishonest
        choice_right_text: "Turn It In",
        effect_right: { reputation: +5 } // Seen as honest
    },
    {   id: "overheard_information",
        tags: ['laborer', 'factory', 'opportunity', 'danger'],
        character: "weary_worker", // Source of info
        image: "images/factory_owner.png", // Subject of info
        text: "You overhear the Foreman discussing a production flaw the owner doesn't know about.",
        choice_left_text: "Inform the Owner Directly",
        effect_left: { reputation: +10, stability: -15 }, // Big risk, potential reward, makes foreman enemy
        choice_right_text: "Pretend You Heard Nothing",
        effect_right: { stability: +5 } // Safe, complicit in silence
    },
    {   id: "child_factory_work",
        tags: ['laborer', 'family', 'factory', 'danger', 'common'],
        character: "child_worker",
        image: "images/child_worker.png", // Correct
        text: "Times are tough. Sending your eldest child (barely 10) to the factory would bring in vital pennies.",
        choice_left_text: "Send Child to Work",
        effect_left: { wealth: +8, health: -10, stability: -10 }, // Income, but guilt/child's health cost
        choice_right_text: "Keep Child Learning/Safe",
        effect_right: { wealth: -5, reputation: +5, stability: +5 } // Financial strain, but morally better
    },


    // --- ================= Standard Merchantile Cards ================= ---
    {   id: "guild_membership_fee",
        tags: ['merchantile', 'trade', 'city'],
        character: "merchant_guild_leader", image: "images/merchant_guild_leader.png", // NEED IMAGE
        text: "The Merchant's Guild demands its annual membership fee.",
        choice_left_text: "Pay the fee",
        effect_left: { wealth: -20, reputation: +10, stability: +5 }, // Maintains standing
        choice_right_text: "Try to defer payment",
        effect_right: { reputation: -15, stability: -10 } // Lose face, risk expulsion
    },
    {   id: "new_trade_route_risk",
        tags: ['merchantile', 'trade', 'opportunity', 'danger'],
        character: "ship_captain", image: "images/ship_captain.png", // NEED IMAGE
        text: "A captain proposes a risky but potentially lucrative new trade route. Invest?",
        choice_left_text: "Invest Significantly",
        effect_left: { wealth: -30, stability: -10 }, // Potential large gains (follow-up card needed)
        choice_right_text: "Decline the venture",
        effect_right: { stability: +5 } // Safe, missed opportunity
    },
    {   id: "competitor_undercutting",
        tags: ['merchantile', 'trade', 'city', 'danger'],
        character: "rival_merchant", image: "images/rival_merchant.png", // NEED IMAGE
        text: "A rival merchant is aggressively undercutting your prices.",
        choice_left_text: "Match their prices (Eat cost)",
        effect_left: { wealth: -15, reputation: +5 }, // Hurt profit, look strong
        choice_right_text: "Maintain quality/price",
        effect_right: { wealth: +5, reputation: -10, stability: -5 } // Keep profit, lose customers short term?
    },
    {   id: "city_tax_increase",
        tags: ['merchantile', 'city', 'politics'],
        character: "city_tax_collector", image: "images/city_tax_collector.png", // NEED IMAGE
        text: "The city council has voted to increase taxes on businesses.",
        choice_left_text: "Pay grumbling",
        effect_left: { wealth: -10, stability: -5 },
        choice_right_text: "Lobby against it (Costly)",
        effect_right: { wealth: -15, reputation: +5, stability: +5 } // Spend money to influence
    },
     {   id: "hire_assistant",
        tags: ['merchantile', 'trade', 'opportunity'],
        character: "eager_applicant", image: "images/eager_applicant.png", // NEED IMAGE
        text: "Business is growing, but stressful. Hire an assistant?",
        choice_left_text: "Hire help (Costs wage)",
        effect_left: { wealth: -10, health: +10, stability: +5 }, // Less personal stress
        choice_right_text: "Manage it all yourself",
        effect_right: { health: -15, stability: -5 } // Overworked
    },
     {   id: "noble_patronage_query",
        tags: ['merchantile', 'noble', 'opportunity', 'politics', 'city'],
        character: "noble_servant", image: "images/noble_servant.png", // NEED IMAGE
        text: "A minor noble shows interest in patronizing your business. Seeking their favour requires time and gifts.",
        choice_left_text: "Cultivate the connection",
        effect_left: { wealth: -15, reputation: +15, stability: -5 }, // Costly investment in social climbing
        choice_right_text: "Focus on existing clients",
        effect_right: { reputation: -5, stability: +5 } // Safer, maybe seen as unambitious
    },

    {   id: "bulk_goods_offer",
        tags: ['merchantile', 'trade', 'opportunity', 'city'],
        character: "ship_captain", // Or a generic supplier
        image: "images/ship_captain.png", // Correct
        text: "A ship just docked with cheap bulk goods - cotton/spices/tea. Requires significant upfront payment and storage space.",
        choice_left_text: "Buy Large Quantity",
        effect_left: { wealth: -25, stability: -5 }, // Big investment, storage hassle/risk
        choice_right_text: "Buy Smaller Amount",
        effect_right: { wealth: -10, stability: +5 } // Safer, less potential profit
    },
    {   id: "import_tariff_hike",
        tags: ['merchantile', 'trade', 'politics', 'city', 'danger'],
        character: "city_tax_collector",
        image: "images/city_tax_collector.png", // Correct
        text: "New tariffs imposed on imported goods are cutting into your profit margins.",
        choice_left_text: "Raise Your Prices",
        effect_left: { wealth: +5, reputation: -10 }, // Pass cost to customers
        choice_right_text: "Absorb the Cost",
        effect_right: { wealth: -15, reputation: +5 } // Maintain customer loyalty, lower profit
    },
    {   id: "supplier_price_increase",
        tags: ['merchantile', 'trade', 'danger'],
        character: "merchant_guild_leader", // Represents supplier network
        image: "images/merchant_guild_leader.png", // Correct
        text: "Your main supplier is demanding significantly higher prices for raw materials.",
        choice_left_text: "Pay the New Price",
        effect_left: { wealth: -10, stability: +5 }, // Ensures supply, hurts bottom line
        choice_right_text: "Seek New Suppliers",
        effect_right: { reputation: +5, stability: -10 } // Risky, might find better/worse deal, disruption
    },
    {   id: "credit_to_noble",
        tags: ['merchantile', 'noble', 'opportunity', 'danger', 'city'],
        character: "noble_servant",
        image: "images/noble_servant.png", // Correct
        text: "A cash-strapped noble requests goods on credit, promising future patronage (and payment).",
        choice_left_text: "Extend Generous Credit",
        effect_left: { wealth: -15, reputation: +10, stability: -10 }, // Risky investment in connection
        choice_right_text: "Politely Request Cash",
        effect_right: { reputation: -10, stability: +5 } // Safer financially, might offend noble
    },
    {   id: "cargo_insurance_offer",
        tags: ['merchantile', 'trade', 'opportunity'],
        character: "merchant_guild_leader", // Represents insurer
        image: "images/merchant_guild_leader.png", // Correct
        text: "An insurer offers protection for your next shipment against loss or damage, for a hefty premium.",
        choice_left_text: "Purchase Insurance",
        effect_left: { wealth: -10, stability: +10 }, // Reduces risk, costs money
        choice_right_text: "Risk the Voyage Uninsured",
        effect_right: { stability: -5 } // Save money, accept risk (Could lead to follow-up disaster card?)
    },
    {   id: "expand_shopfront",
        tags: ['merchantile', 'city', 'opportunity'],
        character: "rival_merchant", // Represents competition/comparison
        image: "images/rival_merchant.png", // Correct
        text: "Expanding your shopfront could attract more customers, but the renovation is costly.",
        choice_left_text: "Invest in Expansion",
        effect_left: { wealth: -20, reputation: +10, stability: -5 }, // Costly bet on growth
        choice_right_text: "Maintain Current Size",
        effect_right: { stability: +5 } // Fiscally conservative
    },
    {   id: "guild_faction_support",
        tags: ['merchantile', 'politics', 'trade', 'city', 'danger'],
        character: "merchant_guild_leader",
        image: "images/merchant_guild_leader.png", // Correct
        text: "Two factions within the Merchant's Guild vie for control. Supporting one could offer benefits, but make enemies.",
        choice_left_text: "Support 'Progressives'", // Example faction
        effect_left: { wealth: -5, reputation: +5, stability: -10 }, // Invest in a side, creates instability
        choice_right_text: "Remain Neutral",
        effect_right: { reputation: -10, stability: +10 } // Safer, but seen as uncommitted/weak
    },
    {   id: "customer_bad_debt",
        tags: ['merchantile', 'trade', 'danger', 'city'],
        character: "weary_worker", // Could be any customer
        image: "images/weary_worker.png", // Correct
        text: "A regular customer who bought on credit has vanished, owing you a considerable sum.",
        choice_left_text: "Hire Debt Collector (Costly)",
        effect_left: { wealth: -10, reputation: -5, stability: -5 }, // Spend money, harsh rep, might recover some
        choice_right_text: "Write Off the Debt",
        effect_right: { wealth: -15, reputation: +5 } // Lose the full amount, look lenient/weak?
    },
    {   id: "counterfeit_goods_rumor",
        tags: ['merchantile', 'trade', 'danger', 'city'],
        character: "city_tax_collector", // Represents authority/regulation
        image: "images/city_tax_collector.png", // Correct
        text: "Rumors abound of counterfeit goods flooding the market. Checking your inventory takes time.",
        choice_left_text: "Conduct Thorough Check",
        effect_left: { wealth: -5, health: -5, stability: +5 }, // Costs time/effort, ensures quality
        choice_right_text: "Assume Your Goods Are Fine",
        effect_right: { stability: -10 } // Risk selling counterfeits unknowingly
    },
    {   id: "rival_buyout_opportunity",
        tags: ['merchantile', 'trade', 'opportunity', 'city'],
        character: "rival_merchant",
        image: "images/rival_merchant.png", // Correct
        text: "Your main rival's business is failing. You could potentially buy them out cheaply.",
        choice_left_text: "Make an Offer to Buy",
        effect_left: { wealth: -30, reputation: +15, stability: -10 }, // Major investment, eliminates rival
        choice_right_text: "Let Them Fail",
        effect_right: { reputation: -5, stability: +5 } // Less competition soon, but missed chance?
    },
    {   id: "newspaper_advertisement",
        tags: ['merchantile', 'opportunity', 'city'],
        character: "eager_applicant", // Represents marketing/outreach?
        image: "images/default.png", // MISSING ASSET: Newspaper? Using default
        text: "Placing an advertisement in the city newspaper could boost sales, but costs a fair bit.",
        choice_left_text: "Pay for the Advert",
        effect_left: { wealth: -8, reputation: +5 }, // Cost for potential gain
        choice_right_text: "Rely on Word-of-Mouth",
        effect_right: {} // No change, status quo
    },
    {   id: "smuggled_luxury_goods",
        tags: ['merchantile', 'trade', 'opportunity', 'danger', 'city'],
        character: "ship_captain", // Associated with docks/imports
        image: "images/ship_captain.png", // Correct
        text: "A shady contact offers untaxed luxury silks/spices at a remarkably low price.",
        choice_left_text: "Buy the Smuggled Goods",
        effect_left: { wealth: +20, reputation: -15, stability: -15 }, // High profit, high risk/rep damage if caught
        choice_right_text: "Refuse the Offer",
        effect_right: { reputation: +5, stability: +5 } // Maintain integrity
    },
    {   id: "factory_supply_contract",
        tags: ['merchantile', 'factory', 'trade', 'opportunity'],
        character: "factory_owner",
        image: "images/factory_owner.png", // Correct
        text: "Sterling's factory needs a regular supply of raw materials you could source. Requires reliable logistics.",
        choice_left_text: "Secure the Contract",
        effect_left: { wealth: +15, stability: -5 }, // Good income, logistical pressure
        choice_right_text: "Focus on Retail",
        effect_right: {} // Stick to current business model
    },
    {   id: "damaged_shipment_arrival",
        tags: ['merchantile', 'trade', 'danger'],
        character: "ship_captain",
        image: "images/ship_captain.png", // Correct
        text: "Your latest shipment arrived, but rough seas damaged a portion of the goods.",
        choice_left_text: "Sell Damaged Goods Cheaply",
        effect_left: { wealth: -5, reputation: -5 }, // Recoup some loss, hurts brand
        choice_right_text: "Destroy Damaged Stock",
        effect_right: { wealth: -15, reputation: +5 } // Significant loss, protects reputation
    },
    {   id: "employee_theft_suspicion",
        tags: ['merchantile', 'danger', 'common'],
        character: "eager_applicant", // Represents employee
        image: "images/eager_applicant.png", // Correct
        text: "You suspect one of your assistants might be skimming from the till or stock.",
        choice_left_text: "Confront Them Directly",
        effect_left: { reputation: -5, stability: -10 }, // Creates conflict, might be wrong
        choice_right_text: "Monitor Them Discreetly",
        effect_right: { health: -5, stability: -5 } // Stressful, takes time
    },


    // --- ================= Standard Noble Cards ================= ---
    {   id: "manage_estate_harvest",
        tags: ['noble', 'estate'],
        character: "noble_steward", image: "images/noble_steward.png", // NEED IMAGE
        text: "Steward reports a poor harvest. Show leniency to tenants or demand full dues?",
        choice_left_text: "Show Leniency",
        effect_left: { wealth: -15, reputation: +10, stability: +5 }, // Less income, happy tenants
        choice_right_text: "Demand Full Dues",
        effect_right: { wealth: +10, reputation: -15, stability: -15 } // Max income, risk unrest/evictions
    },
    {   id: "attend_royal_court",
        tags: ['noble', 'court', 'politics'],
        character: "court_invitation", image: "images/court_invitation.png", // NEED IMAGE
        text: "An invitation to attend the Royal Court. Requires expensive attire and wastes time, but offers influence.",
        choice_left_text: "Attend the Court",
        effect_left: { wealth: -20, reputation: +10, stability: -5 }, // Costly but visible
        choice_right_text: "Send Regrets",
        effect_right: { reputation: -10, stability: +5 } // Save money, lose influence
    },
    {   id: "rival_noble_insult",
        tags: ['noble', 'court', 'politics', 'danger'],
        character: "rival_noble", image: "images/rival_noble.png", // NEED IMAGE
        text: "A rival noble subtly insults your family name at a gathering.",
        choice_left_text: "Demand satisfaction (Duel?)",
        effect_left: { reputation: +15, health: -10, stability: -20 }, // Risky defense of honor
        choice_right_text: "Ignore the slight",
        effect_right: { reputation: -15, stability: +5 } // Appear weak
    },
     {   id: "arrange_marriage",
        tags: ['noble', 'family', 'politics', 'opportunity'],
        character: "marriage_broker", image: "images/marriage_broker.png", // NEED IMAGE
        text: "A potentially advantageous marriage alliance for your child is proposed. Politically useful, loveless.",
        choice_left_text: "Arrange the Marriage",
        effect_left: { reputation: +10, stability: +15 }, // Political gain
        choice_right_text: "Allow child's choice",
        effect_right: { reputation: -10, stability: -10 } // Risk weaker alliance or scandal
    },
     {   id: "patronize_artist",
        tags: ['noble', 'court', 'opportunity'],
        character: "struggling_artist", image: "images/struggling_artist.png", // NEED IMAGE
        text: "A talented but poor artist seeks your patronage.",
        choice_left_text: "Become their Patron",
        effect_left: { wealth: -15, reputation: +10 }, // Gain cultural cachet
        choice_right_text: "Decline politely",
        effect_right: { reputation: -5 } // Seen as uncultured?
    },
    {   id: "land_dispute",
        tags: ['noble', 'estate', 'danger', 'politics'],
        character: "neighboring_noble", image: "images/neighboring_noble.png", // NEED IMAGE
        text: "A dispute arises with a neighbor over borders defined generations ago.",
        choice_left_text: "Press your claim legally",
        effect_left: { wealth: -10, stability: -10 }, // Costly legal fees, protracted
        choice_right_text: "Seek compromise/Concede",
        effect_right: { wealth: -5, reputation: -10, stability: +10 } // Lose potential land/face, gain stability
    },

    // Add these new cards within your existing 'allCards' array

    // --- ================= NEW Standard Noble Cards ================= ---

    {   id: "invest_in_factory_idea",
        tags: ['noble', 'opportunity', 'politics', 'danger', 'factory'], // Nobles investing in early industry
        character: "inventor_artisan", // Cross-class interaction
        image: "images/inventor_artisan.png", // Correct
        text: "A merchant approaches you seeking noble investment for a new type of factory. Risky, potentially lucrative, but rather... common.",
        choice_left_text: "Invest Substantially",
        effect_left: { wealth: -25, reputation: -5, stability: -10 }, // Financial risk, slight rep hit for 'dirty' business, potential long-term gain
        choice_right_text: "Stick to Land/Titles",
        effect_right: { reputation: +5, stability: +5 } // Maintain traditional noble standing
    },
    {   id: "host_grand_ball",
        tags: ['noble', 'court', 'family', 'opportunity'],
        character: "noble_servant", // Represents planning/household staff
        image: "images/court_invitation.png", // Represents social event
        text: "Hosting a grand ball would solidify your social standing but requires enormous expense.",
        choice_left_text: "Spare No Expense",
        effect_left: { wealth: -30, reputation: +15 }, // Very costly, significant rep boost
        choice_right_text: "Host Modest Gathering",
        effect_right: { wealth: -10, reputation: +5 } // Cheaper, smaller rep gain
    },
    {   id: "distant_relative_scandal",
        tags: ['noble', 'family', 'danger', 'court'],
        character: "royal_advisor", // Represents gossip/court awareness
        image: "images/shadowy_advisor.png", // Represents scandal/secrets
        text: "Word reaches court of scandalous behavior by a distant, but known, relative. Association could tarnish your name.",
        choice_left_text: "Publicly Denounce Them",
        effect_left: { reputation: +5, stability: -10 }, // Protect own rep, family strife
        choice_right_text: "Quietly Offer Support/Silence",
        effect_right: { wealth: -10, reputation: -10, stability: +5 } // Costly cover-up, risk exposure, maintain family ties (sort of)
    },
    {   id: "tenant_grievances",
        tags: ['noble', 'estate', 'politics', 'danger'],
        character: "humble_petitioner", // Represents tenants
        image: "images/humble_petitioner.png", // Correct
        text: "A delegation of tenants from your estate arrives with grievances about the steward's harshness.",
        choice_left_text: "Investigate Steward",
        effect_left: { reputation: +5, stability: -10 }, // Might uncover issues, angers steward
        choice_right_text: "Dismiss Grievances",
        effect_right: { wealth: +5, reputation: -10, stability: -15 } // Maintain order (?), risk unrest
    },
    {   id: "political_appointment_offer",
        tags: ['noble', 'politics', 'court', 'kingdom', 'opportunity'],
        character: "royal_advisor",
        image: "images/royal_advisor.png", // Correct
        text: "You are subtly offered a minor, unpaid, but potentially influential political appointment.",
        choice_left_text: "Accept the Position",
        effect_left: { wealth: -5, reputation: +10, stability: -5 }, // Costs time/money, gains influence
        choice_right_text: "Decline the 'Honor'",
        effect_right: { reputation: -5, stability: +5 } // Avoids burden, misses opportunity
    },
    {   id: "gambling_debt_friend",
        tags: ['noble', 'court', 'family', 'danger'],
        character: "rival_noble", // Represents peer
        image: "images/rival_noble.png", // Correct
        text: "A fellow noble, a supposed friend, asks you to cover a significant gambling debt, hinting at shared secrets.",
        choice_left_text: "Pay Their Debt Discreetly",
        effect_left: { wealth: -20, stability: +5 }, // Costly, maintains connection/avoids blackmail
        choice_right_text: "Refuse to Enable Them",
        effect_right: { reputation: +5, stability: -10 } // Principled stand, risks relationship/secrets exposed
    },
    {   id: "improve_estate_infrastructure",
        tags: ['noble', 'estate', 'opportunity'],
        character: "noble_steward",
        image: "images/noble_steward.png", // Correct
        text: "Your steward suggests investing in new drainage/fencing/roads on the estate to improve yields long-term.",
        choice_left_text: "Fund the Improvements",
        effect_left: { wealth: -15, stability: +5 }, // Investment for future gain
        choice_right_text: "Maintain Status Quo",
        effect_right: {} // No immediate change, misses potential
    },
    {   id: "fashionable_tailor_demand",
        tags: ['noble', 'court', 'family'],
        character: "noble_servant", // Represents household expenses
        image: "images/marriage_broker.png", // Vaguely represents social pressures/appearances
        text: "Maintaining appearances at court requires constant updates to your wardrobe from expensive city tailors.",
        choice_left_text: "Order New Attire",
        effect_left: { wealth: -10, reputation: +5 }, // Keep up appearances
        choice_right_text: "Make Do with Older Styles",
        effect_right: { reputation: -5 } // Seen as unfashionable/falling behind
    },
    {   id: "request_royal_favor",
        tags: ['noble', 'politics', 'court', 'kingdom', 'opportunity', 'danger'],
        character: "royal_advisor",
        image: "images/royal_advisor.png", // Correct
        text: "An opportunity arises to petition the Crown for a specific favor (land grant, minor title, etc.). Success is uncertain.",
        choice_left_text: "Petition the Crown",
        effect_left: { reputation: +5, stability: -10 }, // Costs political capital, risk of refusal/owing favor
        choice_right_text: "Let Opportunity Pass",
        effect_right: { stability: +5 } // Safer, no potential gain
    },
    {   id: "hunting_accident_rumor",
        tags: ['noble', 'estate', 'danger', 'family'],
        character: "neighboring_noble",
        image: "images/neighboring_noble.png", // Correct
        text: "During a hunt on your lands, a guest from a rival family suffers a suspicious 'accident'.",
        choice_left_text: "Launch Full Inquiry",
        effect_left: { reputation: +5, stability: -15 }, // Transparent, but stirs up trouble
        choice_right_text: "Hush It Up Quickly",
        effect_right: { wealth: -10, reputation: -10, stability: +5 } // Pay hush money, risk rumors/guilt
    },
     {   id: "support_local_militia",
        tags: ['noble', 'estate', 'politics', 'danger'],
        character: "noble_steward", // Represents local affairs
        image: "images/royal_guard.png", // Represents armed force/authority
        text: "The local volunteer militia requires funding for new equipment. Supporting them enhances your local authority.",
        choice_left_text: "Fund the Militia",
        effect_left: { wealth: -10, stability: +10 }, // Increases local power/order
        choice_right_text: "Let Them Manage",
        effect_right: { stability: -5 } // Potential decline in local order/influence
    },
     {   id: "dueling_etiquette_breach",
        tags: ['noble', 'court', 'politics', 'danger'],
        character: "rival_noble",
        image: "images/rival_noble.png", // Correct
        text: "You are challenged to a duel over a perceived slight, but the challenger's conduct borders on improper.",
        choice_left_text: "Accept the Duel Anyway",
        effect_left: { reputation: +10, health: -20, stability: -10 }, // Defend honor physically, high risk
        choice_right_text: "Refuse on Procedural Grounds",
        effect_right: { reputation: -15, stability: +5 } // Appear cowardly, but avoid injury/legal trouble
    },
     {   id: "inheritance_dispute",
        tags: ['noble', 'family', 'danger', 'politics'],
        character: "marriage_broker", // Represents legal/family arrangements
        image: "images/marriage_broker.png", // Correct
        text: "A contested clause in a will pits you against another branch of the family for a piece of inheritance.",
        choice_left_text: "Fight Vigorously in Court",
        effect_left: { wealth: -15, stability: -15 }, // Costly legal battle, family feud
        choice_right_text: "Seek Amicable Settlement",
        effect_right: { wealth: -5, reputation: -5, stability: +10 } // Lose some potential gain, preserve peace
    },
     {   id: "rising_merchant_snub",
        tags: ['noble', 'merchantile', 'court', 'politics'],
        character: "merchant_guild_leader", // Represents the other class
        image: "images/merchant_guild_leader.png", // Correct
        text: "A wealthy merchant attempts to engage you socially, clearly seeking legitimacy. How do you respond?",
        choice_left_text: "Offer Polite Condescension",
        effect_left: { reputation: +5 }, // Reinforce noble superiority
        choice_right_text: "Treat Them Cordially (Useful?)",
        effect_right: { reputation: -5, stability: +5 } // Might be useful later, but lowers traditional standing
    },

    // --- END NEW NOBLE CARDS ---

    // --- ================= Standard Royalty Cards ================= ---
    {   id: "appoint_advisor",
        tags: ['royalty', 'kingdom', 'politics'],
        character: "two_candidates", image: "images/two_candidates.png", // NEED IMAGE
        text: "Appoint a new advisor: The competent but unpopular statesman, or the charismatic but less skilled court favorite?",
        choice_left_text: "Appoint Competent One",
        effect_left: { reputation: -10, stability: +10 }, // Nobles grumble, kingdom runs better
        choice_right_text: "Appoint Court Favorite",
        effect_right: { reputation: +10, stability: -10 } // Nobles happy, risk incompetence
    },
     {   id: "declare_war_rumor",
        tags: ['royalty', 'kingdom', 'politics', 'danger'],
        character: "general_advisor", image: "images/general_advisor.png", // NEED IMAGE
        text: "Generals propose a 'pre-emptive' war against a neighboring kingdom showing weakness. Risky but potential glory/land.",
        choice_left_text: "Prepare for War",
        effect_left: { wealth: -40, reputation: +10, stability: -25 }, // Huge cost, popularity gamble, instability
        choice_right_text: "Seek Diplomacy",
        effect_right: { wealth: -10, reputation: -10, stability: +15 } // Cost of diplomats, appear weak? but stable
    },
    {   id: "petition_for_justice",
        tags: ['royalty', 'kingdom', 'court', 'politics'],
        character: "humble_petitioner", image: "images/humble_petitioner.png", // NEED IMAGE
        text: "A commoner petitions the throne directly, claiming injustice by a powerful noble.",
        choice_left_text: "Investigate the Noble",
        effect_left: { reputation: +10, stability: -15 }, // Popular support, angers nobility
        choice_right_text: "Dismiss the Petition",
        effect_right: { reputation: -15, stability: +10 } // Appease noble, commoners grumble
    },
    {   id: "build_monument",
        tags: ['royalty', 'kingdom', 'opportunity'],
        character: "royal_architect", image: "images/royal_architect.png", // NEED IMAGE
        text: "Your architect proposes a grand monument to your reign. Extremely expensive but boosts prestige.",
        choice_left_text: "Build the Monument",
        effect_left: { wealth: -50, reputation: +25 }, // Huge cost, huge prestige
        choice_right_text: "Invest funds elsewhere",
        effect_right: { reputation: -5 } // Prudent, but less glorious
    },
     {   id: "heir_concerns",
        tags: ['royalty', 'kingdom', 'family', 'politics'],
        character: "royal_spouse", image: "images/royal_spouse.png", // NEED IMAGE
        text: "Concerns arise about the suitability or health of your designated heir.",
        choice_left_text: "Groom them rigorously",
        effect_left: { stability: -10 }, // Pressure on heir/family
        choice_right_text: "Consider alternatives subtly",
        effect_right: { reputation: -10, stability: -20 } // Risk succession crisis/rumors
    },


    // --- ================= Death Outcome Cards (Tagged as Needed?) ================= ---
    // Death cards don't strictly need tags if only triggered by logic,
    // but tagging doesn't hurt if needed for other systems later.
    {
        id: "machine_accident_fatal", is_death: true, tags:['laborer', 'factory', 'danger'],
        character: "broken_machine", image: "images/broken_machine.png",
        text: "A slip, a cry, silence. The machine demands its price.",
        death_message: "Consumed by the uncaring gears of industry. Your life ended on the factory floor.", effect_left: {}, effect_right: {}
    },
    {
        id: "eviction_death", is_death: true, tags:['laborer', 'slum', 'danger'],
        character: "slum_alley", image: "images/slum_alley.png",
        text: "Penniless, homeless. The biting cold seeps into your bones.",
        death_message: "Evicted and exposed, you perished from cold and hunger in the city's shadows.", effect_left: {}, effect_right: {}
    },
    {
        id: "strike_violence_death", is_death: true, tags:['laborer', 'union', 'danger', 'politics'],
        character: "police_baton", image: "images/police_baton.png",
        text: "Shouts, chaos, a sudden blow. Darkness.",
        death_message: "The strike turned violent. You were struck down in the chaos.", effect_left: {}, effect_right: {}
    },
     {
        id: "disease_death", is_death: true, tags:['common', 'health', 'danger', 'slum', 'city'],
        character: "quack_doctor", image: "images/quack_doctor.png",
        text: "The fever climbs. Breathing becomes a chore. The city's sickness claims another.",
        death_message: "Overwork, poor sanitation, and lack of medicine took their toll.", effect_left: {}, effect_right: {}
    },
    {
        id: "overthrow_failed_death", is_death: true, tags: ['noble', 'politics', 'danger'],
        character: "royal_guard", image: "images/royal_guard.png",
        text: "Betrayal! Guards surround you. There's no escape.",
        death_message: "You reached for the crown but found only the headsman's axe.", effect_left: {}, effect_right: {}
     },
     {
        id: "loyalty_death", is_death: true, tags: ['noble', 'court', 'politics', 'danger'],
        character: "poisoned_goblet", image: "images/poisoned_goblet.png",
        text: "A celebratory toast... but the wine tastes bitter. A sharp pain...",
        death_message: "Loyalty wasn't enough. The paranoid Crown saw you as a threat.", effect_left: {}, effect_right: {}
      },
       // --- ================= Guide's Trial Chain ================= ---

    // --- Trigger Card ---
    {
        id: "guide_trial_offer",
        // Available to those seeking upward mobility
        tags: ['laborer', 'opportunity', 'common'],
        // Make it less common? Add rarity logic later if needed.
        character: "spirit_guide",
        image: "images/spirit_guide.png", // Correct
        text: "The Spirit Guide manifests. 'The currents of fate stagnate. Seek ye a greater destiny? Answer my riddles three, and fortune may smile upon thee. Fail, and be humbled.'",
        choice_left_text: "Refuse the Trial",
        effect_left: { stability: +5 }, // Safe choice
        choice_right_text: "Accept the Trial",
        effect_right: { stability: -5, next_card_id: "guide_riddle_1" } // Begin the chain
    },

    // --- Riddle 1 ---
    {
        id: "guide_riddle_1",
        tags: ['common', 'opportunity'], // Tags match context
        is_follow_up: true,
        character: "spirit_guide",
        image: "images/spirit_guide.png", // Correct
        text: "First Riddle: 'I have cities, but no houses. Forests, but no trees. Water, but no fish. What am I?'",
        choice_left_text: "A Map", // Correct Answer
        effect_left: { stability: +5, next_card_id: "guide_riddle_2_prompt" }, // Small boost, proceed
        choice_right_text: "A Dream", // Incorrect Answer
        effect_right: { stability: -10, next_card_id: "guide_trial_failure" } // Penalty, end chain
    },
    { // Intermediate prompt card for flow
        id: "guide_riddle_2_prompt",
        tags: ['common', 'opportunity'],
        is_follow_up: true,
        character: "spirit_guide",
        image: "images/spirit_guide.png",
        text: "The Guide nods slowly. 'Astute. One riddle remains between thee and the second trial.'",
        choice_left_text: "Proceed",
        effect_left: { next_card_id: "guide_riddle_2" },
        choice_right_text: "Proceed",
        effect_right: { next_card_id: "guide_riddle_2" }
    },

    // --- Riddle 2 ---
    {
        id: "guide_riddle_2",
        tags: ['common', 'opportunity'],
        is_follow_up: true,
        character: "spirit_guide",
        image: "images/spirit_guide.png", // Correct
        text: "Second Riddle: 'What has an eye, but cannot see?'",
        choice_left_text: "A Potato", // Incorrect Answer (common trick)
        effect_left: { stability: -10, next_card_id: "guide_trial_failure" }, // Penalty, end chain
        choice_right_text: "A Needle / Storm", // Correct Answer(s)
        effect_right: { stability: +5, next_card_id: "guide_riddle_3_prompt" } // Small boost, proceed
    },
    { // Intermediate prompt card for flow
        id: "guide_riddle_3_prompt",
        tags: ['common', 'opportunity'],
        is_follow_up: true,
        character: "spirit_guide",
        image: "images/spirit_guide.png",
        text: "A faint glimmer appears in the Guide's form. 'Keen insight. The final question awaits.'",
        choice_left_text: "Face the Last",
        effect_left: { next_card_id: "guide_riddle_3" },
        choice_right_text: "Face the Last",
        effect_right: { next_card_id: "guide_riddle_3" }
    },

    // --- Riddle 3 ---
    {
        id: "guide_riddle_3",
        tags: ['common', 'opportunity'],
        is_follow_up: true,
        character: "spirit_guide",
        image: "images/spirit_guide.png", // Correct
        text: "Third Riddle: 'I am always hungry, I must always be fed. The finger I lick, Will soon turn red. What am I?'",
        choice_left_text: "A Baby", // Incorrect Answer
        effect_left: { stability: -10, next_card_id: "guide_trial_failure" }, // Penalty, end chain
        choice_right_text: "Fire", // Correct Answer
        effect_right: { stability: +10, next_card_id: "guide_trial_success" } // Larger boost, go to success
    },

    // --- Success Outcome ---
    {
        id: "guide_trial_success",
        tags: ['common', 'opportunity'],
        is_follow_up: true,
        character: "spirit_guide",
        image: "images/spirit_guide.png", // Correct
        text: "The Spirit Guide glows brightly. 'Thou hast proven thy wit! The currents shift in thy favor. Embrace the change!' A surge of energy flows through you.",
        // SIGNIFICANT BOOST TO ALL STATS! Adjust values as needed for balance.
        effect_consequence: { wealth: +25, reputation: +25, health: +20, stability: +20 },
        choice_left_text: "Grateful",
        effect_left: {}, // End chain here
        choice_right_text: "Grateful",
        effect_right: {} // End chain here
    },

    // --- Failure Outcome ---
    {
        id: "guide_trial_failure",
        tags: ['common', 'danger'], // Tagged as danger due to penalty
        is_follow_up: true,
        character: "spirit_guide",
        image: "images/spirit_guide.png", // Correct
        text: "The Guide's form wavers, disappointed. 'Alas, understanding eludes thee this time. Perhaps another cycle...' You feel a drain on your resolve.",
        // Minor penalty for failure, mostly the stability hits from wrong answers.
        effect_consequence: { health: -5, stability: -5 }, // Additional small penalty
        choice_left_text: "Humbled",
        effect_left: {}, // End chain here
        choice_right_text: "Humbled",
        effect_right: {} // End chain here
    }

    // --- END Guide's Trial Chain ---
    // --- Add More Death Scenarios for different classes ---
    // e.g., Merchant death: bankrupt -> debtors prison -> death; Shipwrecked; Killed by bandits
    // e.g., Noble death: Duel gone wrong; Political assassination; Executed for treason
    // e.g., Royalty death: Assassination; Overthrown (by player in another life?); Died in war lead personally
    ];

    // --- Game State ---
    let stats = {};
    let currentDeck = [];
    let currentCardIndex = 0;
    let isGameOver = false;
    let isDragging = false;
    let startX = 0;
    let currentX = 0;
    const dragThreshold = 50;
    let currentClassId = 'laborer';
    let currentClassData = null;
    let classChangedThisTurn = false; // Add this near your other state variables

    // --- DOM Elements ---
    let cardElement, cardImage, cardText, choiceTextLeft, choiceTextRight,
        feedbackLeft, feedbackRight, statFills, thresholdMarkers = {},
        endScreen, endTitle, endMessage, restartButton, classDisplayElement,endImage;

    // --- Helper Function: cacheDOMElements (Checks ALL needed elements) ---
    function cacheDOMElements() {
        cardElement = document.getElementById('card');
        cardImage = document.getElementById('card-image');
        cardText = document.getElementById('card-text');
        choiceTextLeft = document.getElementById('choice-text-left');
        choiceTextRight = document.getElementById('choice-text-right');
        feedbackLeft = document.getElementById('swipe-feedback-left');
        feedbackRight = document.getElementById('swipe-feedback-right');
        statFills = {
            wealth: document.getElementById('wealth-fill'),
            reputation: document.getElementById('reputation-fill'),
            health: document.getElementById('health-fill'),
            stability: document.getElementById('stability-fill'),
        };
        thresholdMarkers = {
            wealth: { next: document.getElementById('wealth-next-thresh'), prev: document.getElementById('wealth-prev-thresh') },
            reputation: { next: document.getElementById('reputation-next-thresh'), prev: document.getElementById('reputation-prev-thresh') },
            health: { next: document.getElementById('health-next-thresh'), prev: document.getElementById('health-prev-thresh') },
            stability: { next: document.getElementById('stability-next-thresh'), prev: document.getElementById('stability-prev-thresh') },
        };
        classDisplayElement = document.getElementById('class-display');
        endScreen = document.getElementById('end-screen');
        endTitle = document.getElementById('end-title');
        endMessage = document.getElementById('end-message');
        restartButton = document.getElementById('restart-button');
        endImage = document.getElementById('end-image');

        // Comprehensive Validation
        let allFound = true;
        const elementGroups = [ // Check all elements are present
            { obj: { cardElement, cardImage, cardText, choiceTextLeft, choiceTextRight, feedbackLeft, feedbackRight, classDisplayElement, endScreen, endTitle, endMessage, restartButton }, name: "Base UI"},
            { obj: statFills, name: "Stat Fills"},
            { obj: thresholdMarkers.wealth, name: "Wealth Markers" },
            { obj: thresholdMarkers.reputation, name: "Reputation Markers" },
            { obj: thresholdMarkers.health, name: "Health Markers" },
            { obj: thresholdMarkers.stability, name: "Stability Markers" }
        ];

        for (const group of elementGroups) {
            for (const key in group.obj) {
                 if (!group.obj[key]) {
                     console.error(`FATAL ERROR: ${group.name} element missing for key "${key}". Expected ID related to '${key}'. Check HTML.`);
                     allFound = false;
                 }
             }
        }

        if (!allFound) {
            alert("Initialization Error: Missing required HTML elements. Check console for details.");
        } else {
            console.log("DOM Elements cached successfully.");
        }
        return allFound;
    }

    // --- Helper Functions ---
    function shuffleArray(array) { /* ... as before ... */
         for (let i = array.length - 1; i > 0; i--) {
             const j = Math.floor(Math.random() * (i + 1));
             [array[i], array[j]] = [array[j], array[i]];
         }
         return array;
    }

    function getGameOverMessage(stat, condition) {
        // --- MAKE SURE THESE ARE FILLED IN ---
        const messages = {
            wealth: {
                low:  { title: "Debtors' Prison", msg: "Crushed by debt, you waste away in a squalid cell, forgotten by the world." },
                high: { title: "Target of Envy", msg: "Your immense wealth attracted dangerous attention. A knife in the dark ends your accumulation." } // Example for merchantile/noble maybe? Adjust per class rules.
            },
            reputation: {
                low:  { title: "Ostracized", msg: "Shunned and despised, you live out your days in lonely isolation." },
                high: { title: "Too Visible", msg: "Your fame made you a target for rivals and revolutionaries. You were removed." } // Example for noble/royalty maybe?
            },
            health: {
                low:  { title: "Consumed by Illness", msg: "Your body finally succumbed to the hardships, disease, or injuries of this life." },
                high: { title: "Burned Out", msg: "You pushed yourself too hard for too long. Your constitution shattered under the strain." } // Example: Can high health be fatal? Maybe not usually. Adjust logic/definitions.
            },
            stability: {
                low:  { title: "Chaos Claims You", msg: "Society crumbled around you, or your own mind fractured. You were lost in the ensuing chaos." },
                high: { title: "Oppressive Order", msg: "The rigid control you exerted (or endured) became unbearable, leading to a violent end or stagnation." } // Example: Can high stability be fatal? Adjust logic/definitions.
            }
        };
        // --- END MAKE SURE ---
    
        const specificMsg = messages[stat]?.[condition];
        if (specificMsg && specificMsg.msg && specificMsg.msg !== "...") {
             return { title: specificMsg.title, message: specificMsg.msg };
        } else {
            // Generic fallback if message is missing or still placeholder
            console.warn(`Missing or placeholder game over message for ${stat}/${condition}.`);
            let reason = `${condition} ${stat}`;
            if (condition === 'low') reason = `a lack of ${stat}`;
            if (condition === 'high') reason = `an excess of ${stat}`;
            return { title: "An Unexpected End", message: `Your journey ended abruptly due to ${reason}.` };
        }
    }

    function getRandomInt(min, max) { /* ... as before ... */
         min = Math.ceil(min); max = Math.floor(max); return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function chooseWeightedRandomClass(weights) { /* ... as before ... */
         let total = weights.reduce((sum, i)=>sum+i.weight,0); if(total<=0) return weights[0]?.classId||'laborer'; let r = Math.random()*total; for(const i of weights) {if(r<i.weight)return i.classId; r-=i.weight;} return weights[0]?.classId||'laborer';
    }

    // --- Core Game Logic ---

    function startGame() {
        console.log("Executing startGame...");
        isGameOver = false;
        isDragging = false;
        stats = {};
        classChangedThisTurn = false; // Ensure flag is reset at start
        const startClassId = chooseWeightedRandomClass(GameSettings.initialClassWeights);
        currentClassData = ClassDefinitions[startClassId];
        if (!currentClassData) {
            console.error(`FATAL: Start Class definition missing: ${startClassId}.`);
            alert("Error Initializing Game - Missing Class Data");
            return;
        }
        currentClassId = startClassId;
    
        // Initialize stats based on class
        if (!currentClassData.initialStatRanges) {
            stats = { wealth: 50, reputation: 50, health: 50, stability: 50 }; // Default fallback
            console.warn(`No initialStatRanges for ${startClassId}, using defaults.`);
        } else {
            for (const k in statFills) { // Assuming statFills keys match stat names
                if (currentClassData.initialStatRanges[k]) {
                    stats[k] = getRandomInt(currentClassData.initialStatRanges[k][0], currentClassData.initialStatRanges[k][1]);
                } else {
                    stats[k] = 50; // Fallback if a specific stat range is missing
                    console.warn(`Missing initialStatRange for '${k}' in class ${startClassId}, using 50.`);
                }
            }
        }
        console.log("Initial stats:", JSON.stringify(stats));
    
        // Update UI for class and stats
        if (classDisplayElement) classDisplayElement.textContent = `Class: ${currentClassData.displayName}`;
        updateStatBars(); // Update bars BEFORE loading card
    
        // --- Inject Intro Card ---
        const introCardTemplate = allCards.find(c => c.id === 'game_start_info');
        if (introCardTemplate) {
            let introCard = { ...introCardTemplate };
            // Customize text
            let birthText = "a soul adrift"; // Default text
            if (currentClassId === 'laborer') birthText = "a Laborer, born into soot and struggle";
            else if (currentClassId === 'merchantile') birthText = "a Merchantile, born to the rhythm of trade";
            else if (currentClassId === 'noble') birthText = "a Noble, born into silks and whispers";
            // Add royalty if starting as royalty is possible later
            introCard.text = introCard.text.replace("[Class Name]", birthText);
    
            currentDeck = [introCard]; // Deck initially ONLY contains the intro card
            currentCardIndex = 0;
            console.log("Prepared introductory card.");
    
        } else {
            console.error("FATAL: Game start info card 'game_start_info' is missing from allCards definition!");
            // Fallback: Regenerate deck normally, but this skips the intro
            regenerateDeck();
            currentCardIndex = 0;
        }
    
        // Reset UI elements and load the first card (which should be the intro card)
        if (endScreen) endScreen.style.display = 'none';
        if (cardElement) cardElement.style.display = 'flex';
        resetCardInteraction(); // Reset visual state of the card area
    
        // Load the card (index 0: either intro card or first regenerated card if intro failed)
        if (currentDeck.length > 0) {
            loadCard(currentCardIndex);
        } else if (!isGameOver) { // Check if regen already failed and ended game
            endGame("No Path Forward", `No scenarios available to begin life as a ${currentClassData.displayName}.`);
        }
    }
    
    // --- Ensure applyChoice handles the dismissal ---
    // The modified applyChoice already includes logic for `justDismissedIntroCard`
    // which triggers `regenerateDeck`.
    function regenerateDeck() {
        console.log(`Regenerating deck for class: ${currentClassId}`);
        currentCardIndex = 0; // Reset index for the new deck
    
        if (!currentClassData || !currentClassData.allowedCardTags) {
            console.error(`Regen Error: Critical data missing for class ${currentClassId}. Cannot generate deck.`);
            currentDeck = []; // Ensure deck is empty if data is missing
            // Optionally: endGame("Configuration Error", "Missing class data.");
            return;
        }
    
        // Ensure allowedCardTags is actually an array for safety
        const allowedTags = Array.isArray(currentClassData.allowedCardTags) ? currentClassData.allowedCardTags : [];
        if (allowedTags.length === 0) {
             console.warn(`Warning: No allowedCardTags defined for class ${currentClassId}.`);
        }
    
        const cards = allCards.filter(c => {
            // --- Basic Exclusions ---
            if (c.is_follow_up || c.is_death || c.is_triggerable) {
                return false;
            }
    
            // --- Tag Validation ---
            if (!Array.isArray(c.tags) || c.tags.length === 0) {
                // console.log(`Card ${c.id || 'untitled'} excluded: Missing or empty tags.`); // Optional: Log excluded cards
                return false; // Exclude cards without valid tags
            }
    
            // --- THE CORE FILTER LOGIC (CHANGED) ---
            // Check if EVERY tag on the card is present in the allowed list for the current class.
            const allTagsAllowed = c.tags.every(tag => allowedTags.includes(tag));
    
            // --- Debug Logging (Optional but helpful) ---
            // if (!allTagsAllowed) {
            //     const forbiddenTags = c.tags.filter(tag => !allowedTags.includes(tag));
            //     console.log(`Card '${c.id}' excluded for class '${currentClassId}'. Reason: Contains forbidden tag(s): [${forbiddenTags.join(', ')}]. Card Tags: [${c.tags.join(', ')}]`);
            // } else {
            //     console.log(`Card '${c.id}' included for class '${currentClassId}'. Card Tags: [${c.tags.join(', ')}]`);
            // }
            // --- End Debug Logging ---
    
            return allTagsAllowed;
        });
    
        console.log(`Found ${cards.length} valid cards for class '${currentClassId}' based on allowed tags: [${allowedTags.join(',')}]`);
    
        // Shuffle the filtered cards
        currentDeck = shuffleArray([...cards]); // Use spread to create a new shuffled array
    
        // Handle edge case: No cards found for the class after filtering
        if (currentDeck.length === 0 && !isGameOver) {
            console.warn(`No suitable cards found for class ${currentClassId} after filtering. Ending game or providing fallback.`);
            // You might want a specific end state here instead of the generic "Quiet Moment"
            endGame("End of the Line", `There were no more relevant events for a ${currentClassData.displayName}. Perhaps a life of quiet obscurity followed?`);
        }
    }

    function loadCard(index) {
         if (endScreen?.style.display !== 'none') endScreen.style.display = 'none'; // Hide end screen if needed
         if (isGameOver || !cardElement) return; // Need card element to load into
         cardElement.style.display = 'flex'; // Make sure card area is visible

         if (index < 0 || index >= currentDeck.length) {
            const triggerCard = checkSpecialCardTriggers();
            if (triggerCard) { currentDeck.push(triggerCard); loadCard(index); return; }
            else { endGame("A Quiet Moment", "..."); return; }
         }

        const card = currentDeck[index];
        console.log(`Loading card ID: ${card?.id || `Index ${index}`}`);
        if (!card || !card.image || !card.text || card.choice_left_text == null || card.choice_right_text == null) {
             console.error(`Skipping invalid card at index ${index}:`, card);
             currentCardIndex++; setTimeout(()=>loadCard(currentCardIndex), 10); return;
         }
        try {
            cardImage.src = card.image; cardImage.alt = card.character || card.id || "Card";
            cardText.textContent = card.text;
            const defaultTxt = card?.is_follow_up ? "Continue" : "...";
            choiceTextLeft.textContent = card.choice_left_text || defaultTxt;
            choiceTextRight.textContent = card.choice_right_text || defaultTxt;
            resetCardInteractionState();
        } catch(e) { console.error("loadCard DOM Error:", e); endGame("Display Error", "."); isGameOver=true; }
    }

    // --- updateStatBars (Includes bar resizing and markers) ---
    function updateStatBars() {
         if (isGameOver || !currentClassData) return;
         let gameOverTriggered = false;
         const visualMax = currentClassData.statBarMax || GameSettings.statMax;
         const visualRange = visualMax - GameSettings.statMin;
         const nextThresholds = currentClassData.nextLevelThreshold;
         const prevThresholds = currentClassData.ascensionThreshold;

         for (const statKey in stats) {
             if (!stats.hasOwnProperty(statKey) || !statFills.hasOwnProperty(statKey)) continue; // Skip if stat or fill element invalid

             // Clamp stat value between 0 and the CLASS visual max
             stats[statKey] = Math.max(GameSettings.statMin, Math.min(visualMax, stats[statKey]));

             // Calculate fill % based on VISUAL range
             const fillPercent = visualRange > 0 ? ((stats[statKey] - GameSettings.statMin) / visualRange) * 100 : 0;
             statFills[statKey].style.width = fillPercent + '%';

             // --- Low/High visuals (based on FIXED 0-100 range) ---
             statFills[statKey].classList.toggle('low', stats[statKey] <= 20);
             statFills[statKey].classList.toggle('high', stats[statKey] >= 90 && stats[statKey] <= GameSettings.statMax);

             // --- Update Markers ---
              const markers = thresholdMarkers[statKey];
             if(markers?.next && markers?.prev){ // Check elements exist
                 // Next marker
                 if (nextThresholds && nextThresholds[statKey] != null) {
                     const nextValue = nextThresholds[statKey];
                     const nextPercent = visualRange > 0 ? ((nextValue - GameSettings.statMin) / visualRange) * 100 : 0;
                      markers.next.style.display = (nextValue >= GameSettings.statMin && nextValue <= visualMax) ? 'block' : 'none';
                      markers.next.style.left = `${Math.min(100, Math.max(0, nextPercent))}%`;
                  } else { markers.next.style.display = 'none'; }
                  // Prev marker
                 if (prevThresholds && prevThresholds[statKey] != null && currentClassId !== 'laborer') {
                      const prevValue = prevThresholds[statKey];
                      const prevPercent = visualRange > 0 ? ((prevValue - GameSettings.statMin) / visualRange) * 100 : 0;
                      markers.prev.style.display = (prevValue >= GameSettings.statMin && prevValue <= visualMax) ? 'block' : 'none';
                      markers.prev.style.left = `${Math.min(100, Math.max(0, prevPercent))}%`;
                  } else { markers.prev.style.display = 'none'; }
              }

             // --- Game Over Checks (use fixed GameSettings.statMin/statMax) ---
             if (!gameOverTriggered) {
                if (stats[statKey] <= GameSettings.statMin) {
                    const endInfo = getGameOverMessage(statKey, 'low');
                    // Decide on an image? Maybe stat-specific generic images?
                    // const imageUrl = `images/death_${statKey}_low.png`; // Example structure
                    endGame(endInfo.title, endInfo.message /*, imageUrl */); // Pass image URL if you have one
                    gameOverTriggered = true;
                } else if (stats[statKey] >= GameSettings.statMax) {
                    // Check if this high stat is actually fatal for the current class
                    if (currentClassData.highStatFailure?.[statKey]) {
                        const endInfo = getGameOverMessage(statKey, 'high');
                        // const imageUrl = `images/death_${statKey}_high.png`; // Example structure
                        endGame(endInfo.title, endInfo.message /*, imageUrl */); // Pass image URL if you have one
                        gameOverTriggered = true;
                    }
                }
             }
         }

         if (!gameOverTriggered) { checkClassChange(); }
     }

    // --- checkClassChange (Uses Revised Demotion Logic) ---
    function checkClassChange() {
        if (isGameOver || !currentClassData) return;
        // --- Ascension ---
         if (currentClassData.nextClassId && currentClassId !== 'noble' && currentClassData.nextLevelThreshold) {
             let canAscend = Object.keys(currentClassData.nextLevelThreshold).every(stat =>
                  stats[stat] >= currentClassData.nextLevelThreshold[stat]);
             if(canAscend) { changeClass(currentClassData.nextClassId); return; }
         }
        // --- Demotion (ALL stats must drop below) ---
         if (currentClassId !== 'laborer' && currentClassData.ascensionThreshold) {
            const reqs = currentClassData.ascensionThreshold;
             // Demote if EVERY required stat is now below its ascension threshold
             let shouldDemote = Object.keys(reqs).every(stat =>
                  stats.hasOwnProperty(stat) && stats[stat] < reqs[stat]);
             if (shouldDemote) {
                 const classIds = Object.keys(ClassDefinitions);
                 const currentIndex = classIds.indexOf(currentClassId);
                 if (currentIndex > 0) {
                     const prevClassId = classIds[currentIndex - 1];
                     console.log(`DEMOTE: All stats below threshold for ${currentClassId}. Falling to ${prevClassId}.`);
                     changeClass(prevClassId); return;
                 }
            }
         }
     }

    // --- changeClass (Handles visual update and info card) ---
    function changeClass(newClassId) {
        if (!ClassDefinitions[newClassId]) { console.error(`ERROR: Invalid class ID: ${newClassId}`); return; }
        console.log(`Changing class from ${currentClassId} to ${newClassId}`);
        currentClassId = newClassId;
        currentClassData = ClassDefinitions[newClassId];
        if (classDisplayElement) classDisplayElement.textContent = `Class: ${currentClassData.displayName}`;
    
        classChangedThisTurn = true; // *** SET THE FLAG HERE ***
    
        updateStatBars(); // Update bar visuals immediately (safe to call again)
    
        // --- Inject Info Card ---
        const infoCardTemplate = allCards.find(c => c.id === SpecialCards.CLASS_CHANGE_INFO);
        if (infoCardTemplate) {
            let infoCard = { ...infoCardTemplate };
            // Ensure the info card isn't accidentally filtered out if we regen too soon
            // Let's remove is_follow_up temporarily or handle it in loading logic
            // delete infoCard.is_follow_up; // Option 1: Remove flag dynamically
    
            infoCard.text = infoCard.text.replace("[Class Name]", currentClassData.displayName);
            currentDeck = currentDeck || [];
            currentDeck.splice(0, 0, infoCard); // Add to start
            currentCardIndex = 0; // Explicitly set index to 0
            console.log("Inserted class change info card at index 0.");
            // No deck regen here, it happens AFTER the info card is dismissed
        } else {
            console.warn("Class change info card missing! Immediate regen fallback.");
            regenerateDeck(); // Fallback: Regen now
            currentCardIndex = 0; // Reset index for new deck
            // This fallback path skips the info card display.
        }
    }

    // --- applyChoice (Handles Info Card dismissal -> Regen) ---
    function applyChoice(direction) {
        if (isGameOver || currentCardIndex < 0 || currentCardIndex >= currentDeck.length) {
             console.warn("applyChoice called with invalid index or game over state.");
             return;
        }
        const card = currentDeck[currentCardIndex];
        if (!card) { endGame("Error", "Card missing during applyChoice"); return; }
    
        console.log(`Apply choice ${direction} for card: ${card.id}`);
        const effect = direction === 'left' ? card.effect_left : card.effect_right;
        let nextCardId = effect?.next_card_id; // Store potential next card ID
    
        // --- Special Card Handling (BEFORE stat changes if they exit early) ---
        if (card.id === SpecialCards.OVERTHROW_PROMPT) {
            if (direction === 'left') {
                // We call changeClass, which sets the flag and injects the info card
                changeClass('royalty');
                // Since changeClass sets index to 0 and the flag, the logic below will handle loading it
            } else {
                triggerSpecialDeath('loyalty_death');
            }
            // IMPORTANT: We MUST NOT proceed further in applyChoice after these actions
            // Schedule the next load based on what changeClass or triggerSpecialDeath did.
            // If changeClass was called, classChangedThisTurn is true.
            if (!isGameOver) { // Only schedule if not dead
                 setTimeout(() => {
                     if (!isGameOver) {
                         resetCardInteraction();
                         loadCard(currentCardIndex); // Load whatever index changeClass set (should be 0)
                         classChangedThisTurn = false; // Reset flag after use
                     }
                 }, 350);
             }
            return; // Exit applyChoice early for this special card
        }
    
        // Check if we are dismissing the info card (for deck regen later)
        let justDismissedInfoCard = (card.id === SpecialCards.CLASS_CHANGE_INFO);
        // *** Check if we are dismissing the INTRO card (add this ID later) ***
        let justDismissedIntroCard = (card.id === 'game_start_info'); // Anticipate intro card ID
    
        // --- Apply Stats ---
        // Apply consequence first (if any), then choice effect
        const consequenceEffect = card.effect_consequence;
        if (consequenceEffect) {
            for(const k in consequenceEffect) {
                if(stats.hasOwnProperty(k)) stats[k] += consequenceEffect[k];
            }
        }
        const choiceEffect = effect; // Already determined if left/right
         if (choiceEffect) {
             for(const k in choiceEffect) {
                 // Apply stat change, but skip 'next_card_id'
                 if(stats.hasOwnProperty(k) && k !== 'next_card_id') stats[k] += choiceEffect[k];
             }
         }
    
        // --- Update Visuals & Check Game State ---
        classChangedThisTurn = false; // Reset flag BEFORE checking stats, changeClass will set it again if needed
        updateStatBars(); // This might call checkClassChange -> changeClass -> set flag to true
        if (isGameOver) return; // Stop if stats caused game over
    
        // --- Deck Regeneration Logic ---
        if (justDismissedInfoCard || justDismissedIntroCard) {
            console.log(`Regenerating deck after dismissing ${justDismissedInfoCard ? 'info' : 'intro'} card.`);
            regenerateDeck();
            currentCardIndex = 0; // Start at the beginning of the new deck
            nextCardId = null; // Don't insert any follow-up from the info/intro card itself
            classChangedThisTurn = false; // Ensure flag is false after regen
        }
    
        // --- Follow-up Card Insertion ---
        // Only insert if NOT dismissing info/intro card and NOT if class changed this turn
        // (because the info card is already the next card)
        if (nextCardId && !justDismissedInfoCard && !justDismissedIntroCard && !classChangedThisTurn) {
            const followUpCard = allCards.find(c => c.id === nextCardId);
            if (followUpCard) {
                // Insert AFTER the current card (which will be removed implicitly by index increment)
                currentDeck.splice(currentCardIndex + 1, 0, followUpCard);
                console.log(`Inserted follow-up card ${nextCardId} at index ${currentCardIndex + 1}`);
            } else {
                console.warn(`Follow-up card ID '${nextCardId}' not found!`);
            }
        }
    
        // --- Advance Card Index ---
        // Only increment if a class change DID NOT happen this turn.
        // If it did, changeClass already set the index to 0 for the info card.
        if (!classChangedThisTurn) {
            currentCardIndex++;
        }
    
        // --- Schedule Next Load ---
        setTimeout(() => {
            if (!isGameOver) {
                resetCardInteraction();
                loadCard(currentCardIndex); // Load the determined next card index
                classChangedThisTurn = false; // Reset flag after the turn/load cycle is scheduled
            }
        }, 350); // Short delay for animation
    }

    // --- Other Core Functions ---
    function checkSpecialCardTriggers() { /* ... as before ... */
        //console.log("Checking triggers...");
        if(currentClassId === 'noble'){
            if(!ClassDefinitions.noble.nextLevelThreshold) return null;
            const thr = ClassDefinitions.noble.nextLevelThreshold;
            let meet = Object.keys(thr).every(stat => stats[stat]>=thr[stat]);
            if(meet) {console.log("Noble overthrow triggered."); return allCards.find(c=>c.id===SpecialCards.OVERTHROW_PROMPT)||null;}
        }
         return null;
    }

    function triggerSpecialDeath(deathCardId) {
        if (isGameOver) return;
        const c = allCards.find(d => d.id === deathCardId && d.is_death);
        if (c) {
            console.log(`Triggering special death: ${deathCardId}`);
            // Ensure death_message exists and is not empty, provide fallback
            const message = c.death_message && c.death_message.trim() !== "..." && c.death_message.trim() !== ""
                          ? c.death_message
                          : "Your journey met an untimely and undescribed end.";
            const title = c.character || "Fate"; // Use character name or "Fate" as title
            const image = c.image || null; // Pass the image URL (or null if missing)
    
            // Call endGame with all parameters
            endGame(title, message, image);
    
            // Fade out the card (optional nice touch)
            if (cardElement) {
                cardElement.style.transition = 'opacity 0.3s';
                cardElement.style.opacity = 0;
                // Optionally hide it completely after fade
                setTimeout(() => { if(cardElement) cardElement.style.display = 'none'; }, 300);
            }
        } else {
            console.error(`ERROR: Attempted to trigger invalid death card ID: ${deathCardId}`);
            // Fallback generic death if ID is wrong
            endGame("An Unknown End", `Something went wrong, and your fate is unclear (Invalid Death ID: ${deathCardId}).`);
        }
    }

    function endGame(title, message, imageUrl = null) { // Add imageUrl parameter with default null
        if (isGameOver) return;
        isGameOver = true;
        console.log(`--- GAME OVER --- Title: "${title}" Message: "${message}" ${imageUrl ? `Image: ${imageUrl}` : '(No Image)'}`);
    
        if (endTitle) endTitle.textContent = title;
        if (endMessage) endMessage.textContent = message;
    
        // --- Handle the End Screen Image ---
        if (endImage) { // Check if the element was cached successfully
            if (imageUrl) {
                console.log(`Setting end image src to: ${imageUrl}`);
                endImage.src = imageUrl;
                endImage.alt = title || "Final Scene"; // Use title for alt text
                endImage.style.display = 'block'; // Make the image visible
                 // Optional: Add error handling for broken image links
                 endImage.onerror = () => {
                     console.warn(`Failed to load end screen image: ${imageUrl}`);
                     endImage.style.display = 'none'; // Hide if loading fails
                 };
            } else {
                console.log("No image URL provided for end screen.");
                endImage.style.display = 'none'; // Hide the image element if no URL
                endImage.src = ''; // Clear src to avoid showing old image
                endImage.onerror = null; // Remove previous error handler
            }
        } else {
            console.warn("End screen image element (#end-image) not found in cache.");
        }
    
        if (cardElement) cardElement.style.display = 'none';
        if (endScreen) {
            endScreen.style.display = 'flex'; // Show the end screen
        } else {
            console.error("FATAL: End screen container element (#end-screen) not found!");
            // Optionally, use a fallback alert if the end screen itself is missing
            // alert(`Game Over: ${title}\n${message}`);
        }
    }
    


    // --- Interaction Functions (Add Debug Logs, passive: false) ---
    function dragStart(event) {
        console.log("dragStart firing", event.type); // Log event type
        if (isGameOver || isDragging) return;
        isDragging = true;
        try { // Add try/catch for safety accessing event properties
             startX = event.pageX ?? event.touches?.[0]?.pageX; // Use nullish coalescing
             if (startX == null) { // Check if startX failed to set
                 console.warn("dragStart: Could not get initial pageX.");
                 isDragging = false; return;
             }
        } catch(e) {console.error("Error getting pageX in dragStart:",e); isDragging = false; return;}

         if (cardElement) {
             cardElement.classList.add('dragging');
             cardElement.style.transition = 'transform 0.05s linear';
         } else {console.error("dragStart: cardElement is missing!"); isDragging=false; return;}
         // Use preventDefault for touch to avoid page scrolling during drag
        if(event.cancelable) event.preventDefault(); // Check if cancelable before calling
         console.log(`dragStart success, isDragging: ${isDragging}, startX: ${startX}`);
    }


    function dragMove(event) {
        if (!isDragging || isGameOver) return;
         // console.log("dragMove firing"); // Can be very noisy, enable if needed

         try { // Add try/catch
            currentX = event.pageX ?? event.touches?.[0]?.pageX;
            if (currentX == null) { console.warn("dragMove: Could not get pageX."); return;} // Ignore move if no coordinate
         } catch(e) {console.error("Error getting pageX in dragMove:",e); return;}


         const deltaX = currentX - startX;
         if(cardElement) {
             const rotateDeg = deltaX / 15;
             cardElement.style.transform = `translateX(${deltaX}px) rotate(${rotateDeg}deg)`;
         }

        // Update feedback
        const opacity = Math.min(Math.abs(deltaX) / dragThreshold, 0.8);
        if (deltaX > 10) {
            if(choiceTextRight) choiceTextRight.style.opacity = opacity;
            if(feedbackRight) feedbackRight.style.opacity = opacity / 2;
            if(choiceTextLeft) choiceTextLeft.style.opacity = 0;
            if(feedbackLeft) feedbackLeft.style.opacity = 0;
        } else if (deltaX < -10) {
            if(choiceTextLeft) choiceTextLeft.style.opacity = opacity;
            if(feedbackLeft) feedbackLeft.style.opacity = opacity / 2;
            if(choiceTextRight) choiceTextRight.style.opacity = 0;
            if(feedbackRight) feedbackRight.style.opacity = 0;
        } else { resetCardInteractionState(); }
    }


    function dragEnd(event) {
        console.log("dragEnd firing"); // Log when it fires
        if (!isDragging || isGameOver) return; // Don't process if not dragging or game over

         isDragging = false; // Set isDragging to false *immediately*

        if (cardElement) cardElement.classList.remove('dragging');
        else { console.error("dragEnd: cardElement missing!"); return; } // Cannot proceed

        // Check currentDeck bounds again for safety
        if (currentCardIndex < 0 || currentCardIndex >= currentDeck.length) {
            console.warn("dragEnd: Invalid index, snapping card back.");
             cardElement.style.transition = 'transform 0.3s ease-out';
             cardElement.style.transform = 'translateX(0) rotate(0deg)';
             resetCardInteractionState(); startX = 0; currentX = 0;
             return;
         }


        const deltaX = currentX - startX;
         console.log(`dragEnd: deltaX = ${deltaX}, dragThreshold = ${dragThreshold}`);
        let direction = null;
        const card = currentDeck[currentCardIndex]; // Now safe to access

        // Determine direction (handles 'Continue' cards)
        if (card?.is_follow_up && card.choice_left_text === card.choice_right_text) {
            if (Math.abs(deltaX) > dragThreshold / 2) direction = 'right';
        } else {
            if (deltaX > dragThreshold) direction = 'right';
            else if (deltaX < -dragThreshold) direction = 'left';
        }

        if (direction) { // Swipe SUCCEEDED
            console.log(`Swipe SUCCESS: ${direction}. Animating out.`);
            const flyX = direction === 'right' ? window.innerWidth : -window.innerWidth; // Fly further
            const flyRotate = direction === 'right' ? 30 : -30;
            cardElement.style.transition = 'transform 0.3s ease-out, opacity 0.3s ease-out';
            cardElement.style.transform = `translateX(${flyX}px) rotate(${flyRotate}deg)`;
            cardElement.style.opacity = 0;
            resetCardInteractionState(); // Clear visual hints during fly off
            // Call applyChoice *after* starting animation
            applyChoice(direction);
        } else { // Swipe FAILED (or wasn't a swipe)
            console.log("Swipe FAILED or reset.");
             cardElement.style.transition = 'transform 0.3s ease-out';
             cardElement.style.transform = 'translateX(0) rotate(0deg)';
             resetCardInteractionState(); // Clear visual hints
        }

        // Reset start/current X regardless of outcome
         startX = 0;
         currentX = 0;
         console.log(`dragEnd completed. isDragging: ${isDragging}`);
    }


    // --- Visual Reset Functions ---
    function resetCardInteraction() { /* ... (as before, keep checks) ... */
        if(cardElement) {
             cardElement.style.transition = 'none'; cardElement.style.transform='translateX(0) rotate(0deg)'; cardElement.style.opacity=1;
             void cardElement.offsetWidth; // Reflow
             cardElement.style.transition = 'transform 0.3s ease-out, opacity 0.3s ease-out';
             resetCardInteractionState();
         }
    }
    function resetCardInteractionState() { /* ... (as before, keep checks) ... */
        if(choiceTextLeft) choiceTextLeft.style.opacity = 0; if(choiceTextRight) choiceTextRight.style.opacity=0;
        if(feedbackLeft) feedbackLeft.style.opacity = 0; if(feedbackRight) feedbackRight.style.opacity = 0;
    }

    // --- Event Listeners (Using passive: false for touchmove) ---
    function setupEventListeners() {
        if (!cardElement || !restartButton) { console.error("Cannot setup listeners."); return; }
        console.log("Setting up event listeners...");
        // Remove potentially existing listeners before adding new ones (safer)
         cardElement.removeEventListener('mousedown', dragStart); cardElement.addEventListener('mousedown', dragStart);
         document.removeEventListener('mousemove', dragMove); document.addEventListener('mousemove', dragMove);
         document.removeEventListener('mouseup', dragEnd); document.addEventListener('mouseup', dragEnd);
         cardElement.removeEventListener('touchstart', dragStart); cardElement.addEventListener('touchstart', dragStart, { passive: false });
         document.removeEventListener('touchmove', dragMove); document.addEventListener('touchmove', dragMove, { passive: false }); // <-- Use passive: false
         document.removeEventListener('touchend', dragEnd); document.addEventListener('touchend', dragEnd);
         restartButton.removeEventListener('click', startGame); restartButton.addEventListener('click', startGame);
         console.log("Event listeners setup complete.");
    }

    // --- Initial Game Setup ---
    console.log("DOM Ready. Caching elements...");
    if (cacheDOMElements()) {
        console.log("Initialization sequence: Starting game...");
        startGame();
        console.log("Initialization sequence: Setting up listeners...");
        setupEventListeners(); // Setup listeners after DOM is ready and game starts
        console.log("Initialization sequence complete.");
    } else {
        console.error("FATAL: Game Initialization Failed - Missing DOM elements.");
    }

}); // End DOMContentLoaded