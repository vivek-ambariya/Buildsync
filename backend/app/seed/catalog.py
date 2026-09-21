"""Static demo catalogue: the people, projects and material specs.

Kept apart from the seeding logic so the numbers stay easy to read and edit.
Every project is modelled on a real Gujarat development brief: unit mix,
budget scale, phase sequence and supplier names all follow site practice.
"""

PASSWORD = "buildsync"

PEOPLE = [
    # One role each: an account is one person doing one job, so there is no
    # multi-role case to seed.
    {"name": "Vivek Ambariya", "email": "vivek@buildsync.ai", "role": "admin",
     "title": "Director of Projects", "phone": "+91 98250 41207"},
    {"name": "Meera Shah", "email": "meera.shah@buildsync.ai", "role": "project_manager",
     "title": "Senior Project Manager", "phone": "+91 98795 22014"},
    {"name": "Rajesh Patel", "email": "rajesh.patel@buildsync.ai", "role": "project_manager",
     "title": "Project Manager, Commercial", "phone": "+91 99042 88361"},
    {"name": "Anil Kumar", "email": "anil.kumar@buildsync.ai", "role": "site_engineer",
     "title": "Site Engineer, Structures", "phone": "+91 97129 44508"},
    {"name": "Priya Nair", "email": "priya.nair@buildsync.ai", "role": "site_engineer",
     "title": "Site Engineer, MEP", "phone": "+91 96019 73320"},
    {"name": "Devansh Joshi", "email": "devansh.joshi@buildsync.ai", "role": "site_engineer",
     "title": "Site Engineer, Finishing", "phone": "+91 94268 11794"},
    {"name": "Suresh Yadav", "email": "suresh@yadavconstructions.in", "role": "contractor",
     "title": "Yadav Constructions — RCC", "phone": "+91 93777 60142"},
    {"name": "Farhan Qureshi", "email": "farhan@qkelectricals.in", "role": "contractor",
     "title": "QK Electricals — MEP", "phone": "+91 90999 30845"},
]

PHASES = ["Foundation", "Structure", "Electrical", "Plumbing", "Finishing"]

# progress_target drives everything downstream: tasks, site reports and the
# risk findings all resolve to this number.
PROJECTS = [
    {
        "name": "Skyline Tower", "code": "SKY-01", "category": "Residential",
        "location": "Bopal, Ahmedabad", "client": "Skyline Realty LLP",
        "description": "3B + G + 22 residential tower, 176 units, with a two-level podium clubhouse.",
        "budget": 185_000_000, "started_days_ago": 430, "duration_days": 760,
        "progress_target": 40.0, "spend_ratio": 0.48, "status": "at_risk",
        "manager": "Meera Shah",
        "team": ["Anil Kumar", "Priya Nair", "Suresh Yadav"],
    },
    {
        "name": "Green Valley Residences", "code": "GVR-02", "category": "Residential",
        "location": "Kudasan, Gandhinagar", "client": "Green Valley Infra Pvt Ltd",
        "description": "Nine-block low-rise township, 312 units across 6.4 acres with STP and solar.",
        "budget": 124_000_000, "started_days_ago": 380, "duration_days": 640,
        "progress_target": 71.0, "spend_ratio": 0.66, "status": "active",
        "manager": "Meera Shah",
        "team": ["Devansh Joshi", "Suresh Yadav"],
    },
    {
        "name": "Metro Commercial Hub", "code": "MCH-03", "category": "Commercial",
        "location": "SG Highway, Ahmedabad", "client": "Metro Estates Consortium",
        "description": "Retail podium with four office floors, 2.1 lakh sq ft leasable, LEED Gold target.",
        "budget": 248_000_000, "started_days_ago": 300, "duration_days": 700,
        "progress_target": 44.0, "spend_ratio": 0.50, "status": "at_risk",
        "manager": "Rajesh Patel",
        "team": ["Priya Nair", "Farhan Qureshi"],
    },
    {
        "name": "LJ Business Center", "code": "LJB-04", "category": "Commercial",
        "location": "Sarkhej, Ahmedabad", "client": "LJ Group",
        "description": "G + 8 boutique office block with structured parking and a rooftop amenity deck.",
        "budget": 96_000_000, "started_days_ago": 250, "duration_days": 520,
        "progress_target": 58.0, "spend_ratio": 0.49, "status": "active",
        "manager": "Rajesh Patel",
        "team": ["Devansh Joshi", "Farhan Qureshi"],
    },
    {
        "name": "Sardar Industrial Park II", "code": "SIP-05", "category": "Industrial",
        "location": "Sanand GIDC, Ahmedabad", "client": "Sardar Infraspace",
        "description": "Six pre-engineered warehouse sheds, 28,000 sq m, with a 33 kV substation.",
        "budget": 152_000_000, "started_days_ago": 190, "duration_days": 460,
        "progress_target": 33.0, "spend_ratio": 0.31, "status": "active",
        "manager": "Rajesh Patel",
        "team": ["Anil Kumar", "Suresh Yadav"],
    },
    {
        "name": "Riverfront Residency C", "code": "RFR-06", "category": "Residential",
        "location": "Vasna, Ahmedabad", "client": "Riverfront Housing Board",
        "description": "Block C of the riverfront scheme, 88 units, G + 11, handover-ready finishes.",
        "budget": 78_000_000, "started_days_ago": 520, "duration_days": 600,
        "progress_target": 91.0, "spend_ratio": 0.88, "status": "active",
        "manager": "Meera Shah",
        "team": ["Devansh Joshi", "Priya Nair"],
    },
    {
        "name": "Orchid Square Retail", "code": "ORS-07", "category": "Retail",
        "location": "Alkapuri, Vadodara", "client": "Orchid Retail Ventures",
        "description": "Two-level high-street retail, 34 shops, with a double-height anchor unit.",
        "budget": 54_000_000, "started_days_ago": 120, "duration_days": 390,
        "progress_target": 24.0, "spend_ratio": 0.21, "status": "active",
        "manager": "Rajesh Patel",
        "team": ["Anil Kumar"],
    },
    {
        "name": "Nirvana Heights", "code": "NVH-08", "category": "Residential",
        "location": "Vesu, Surat", "client": "Nirvana Buildcon",
        "description": "Twin 24-storey towers, 240 units, shared podium and 1.2 acre landscaped deck.",
        "budget": 210_000_000, "started_days_ago": 95, "duration_days": 820,
        "progress_target": 12.0, "spend_ratio": 0.11, "status": "planning",
        "manager": "Meera Shah",
        "team": ["Anil Kumar", "Farhan Qureshi"],
    },
]

# (name, category, unit, unit_cost, supplier, lead_time, required_per_crore, cover_profile)
# cover_profile is read against supplier lead time: 'tight' means the site runs
# dry before a replacement could arrive, 'low' means barely enough, 'ok' is safe.
# (name, category, unit, unit_cost, supplier, lead_time, cost_share, cover_profile)
# cost_share is the slice of project budget this material accounts for, which
# is how quantities are actually estimated before a BOQ exists. Quantity is
# derived from it at seed time, so the tonnage matches the build value.
# cover_profile is read against supplier lead time: 'tight' means the site runs
# dry before a replacement could arrive, 'low' means barely enough, 'ok' is safe.
MATERIAL_SPECS = [
    ("TMT Steel Fe550D", "Structural", "tonnes", 62_400, "Shree Balaji Steels", 9, 0.090, "tight"),
    ("OPC 53 Grade Cement", "Structural", "bags", 392, "UltraTech — Sabarmati", 4, 0.060, "ok"),
    ("Ready-Mix Concrete M30", "Structural", "cum", 5_450, "ACC Concrete Sanand", 2, 0.120, "ok"),
    ("AAC Blocks 600x200x150", "Masonry", "cum", 3_250, "Biltech Building Elements", 6, 0.035, "low"),
    ("River Sand (Zone II)", "Masonry", "cum", 1_980, "Narmada Aggregates", 3, 0.025, "ok"),
    ("20mm Coarse Aggregate", "Masonry", "cum", 1_240, "Narmada Aggregates", 3, 0.025, "ok"),
    ("PVC Conduit 25mm", "Electrical", "rmt", 62, "QK Electricals", 7, 0.010, "ok"),
    ("Copper Cable 4 sq mm", "Electrical", "rmt", 148, "Polycab — Vadodara", 12, 0.015, "low"),
    ("CPVC Pipe 25mm", "Plumbing", "rmt", 186, "Astral Pipes", 8, 0.012, "ok"),
    ("Vitrified Tiles 800x800", "Finishing", "sqm", 720, "Kajaria Morbi Works", 14, 0.040, "ok"),
    ("Exterior Emulsion Paint", "Finishing", "ltr", 285, "Asian Paints — Naroda", 6, 0.010, "ok"),
    ("Structural Glazing Unit", "Facade", "sqm", 4_900, "Saint-Gobain Glass India", 21, 0.030, "tight"),
]

# Task templates per phase. Each entry is (title, weight) where weight biases
# how much of the phase the task represents.
TASK_TEMPLATES = {
    "Foundation": [
        "Site clearance and setting out",
        "Excavation for raft footing",
        "Anti-termite treatment",
        "PCC bed and raft reinforcement",
        "Raft concreting and curing",
        "Basement retaining wall shuttering",
    ],
    "Structure": [
        "Column reinforcement — podium level",
        "Slab shuttering, typical floor",
        "Slab concreting, typical floor",
        "Shear wall casting — core",
        "Staircase and landing casting",
        "Block work — typical floors",
    ],
    "Electrical": [
        "Conduiting in slab",
        "DB and riser shaft installation",
        "Cable laying to distribution panels",
        "Earthing pit and lightning arrestor",
        "Lighting fixture installation",
    ],
    "Plumbing": [
        "Sleeve and shaft coordination",
        "CPVC riser installation",
        "Drainage stack and vent piping",
        "Underground tank waterproofing",
        "Sanitary fixture installation",
    ],
    "Finishing": [
        "Internal plaster — wall surfaces",
        "External plaster and texture",
        "Flooring and skirting",
        "Door and window frame fixing",
        "Painting — primer and two coats",
        "Facade glazing installation",
        "Snag list closure and handover",
    ],
}

EXPENSE_TEMPLATES = [
    ("TMT steel supply", "materials", "Shree Balaji Steels"),
    ("Cement procurement", "materials", "UltraTech — Sabarmati"),
    ("RMC pour", "materials", "ACC Concrete Sanand"),
    ("AAC block supply", "materials", "Biltech Building Elements"),
    ("RCC labour contract", "labour", "Yadav Constructions"),
    ("Finishing labour contract", "labour", "Shakti Labour Co-op"),
    ("Tower crane hire", "equipment", "Everest Equipment Rentals"),
    ("Concrete pump hire", "equipment", "Everest Equipment Rentals"),
    ("MEP subcontract milestone", "subcontractor", "QK Electricals"),
    ("Facade subcontract milestone", "subcontractor", "Saint-Gobain Glass India"),
    ("AMC plan sanction fee", "permits", "Ahmedabad Municipal Corporation"),
    ("Fire NOC and consultancy", "permits", "Gujarat Fire Services"),
    ("Site establishment and overheads", "overheads", "Internal"),
    ("Insurance and CAR policy", "overheads", "New India Assurance"),
]

WORK_NOTES = [
    "Slab shuttering completed for the typical floor and checked by the RCC consultant.",
    "Concreting of the podium deck finished; 38 cum poured and cube samples taken.",
    "Column reinforcement tied up to the next lift; cover blocks verified.",
    "Block work progressed on two wings; mortar mix ratio held at 1:6.",
    "Internal plaster started in the east wing after the conduiting handover.",
    "Waterproofing membrane laid in the basement and ponding test started.",
    "External scaffolding erected to the eleventh floor for facade work.",
    "Drainage stack alignment corrected as per the revised plumbing drawing.",
    "Electrical conduit laid in the slab ahead of the next pour.",
    "Tile laying completed in six units; joints left for grouting.",
    "Excavation reached the founding level and the soil was cleared by the geotech engineer.",
    "Lift shaft shuttering aligned and checked for plumb across three floors.",
]

ISSUE_NOTES = [
    "Steel delivery slipped by two days; the supplier has confirmed a revised despatch.",
    "Intermittent rain stopped the pour after noon; curing arrangements were extended.",
    "Labour strength was short by eleven against the planned deployment.",
    "Concrete cube result for the last pour came in below the target strength; retest ordered.",
    "Site access blocked in the morning by a municipal road cut on the approach road.",
    "Revised architectural drawing awaited for the lobby before finishing can start.",
]

WEATHER = ["Clear", "Clear", "Clear", "Hazy", "Overcast", "Light rain", "Hot and dry"]


# --- Demo copy for fields that nothing used to populate ----------------------
# These exist because the seeded portfolio had whole columns sitting empty:
# every expense had a blank note, every site report had a blank note, and no
# material carried a usage history. An empty column reads as a broken feature
# on screen, not as a project with nothing to say.

EXPENSE_NOTES = [
    "Rate held from the original tender; no escalation claimed.",
    "Part payment released against the delivery challan, balance on reconciliation.",
    "Includes unloading and stacking at the site store.",
    "Quantity verified against the measurement sheet before certification.",
    "Escalation of 3% allowed per the contract's steel index clause.",
    "Retention of 5% withheld pending the defect liability period.",
    "Freight charged separately by the supplier; approved by the PM.",
    "Second running account bill for the same work order.",
    "Rate revised after the vendor's quarterly price list was reissued.",
    "Cross-checked against the BOQ line before release.",
]

SITE_UPDATE_NOTES = [
    "Crew rotated to the north face after lunch to stay out of the sun.",
    "Safety briefing held at the gate before the pour started.",
    "Client representative walked the floor and signed off the setting out.",
    "Night shift kept on for the concrete finishing.",
    "Consultant's inspection cleared the reinforcement before closing the shutter.",
    "Curing compound applied the same evening.",
    "Material lift out of service for an hour; loads moved by hoist.",
    "Extra ganger brought in to keep the block work moving.",
    "Third-party testing agency collected cube samples from the pour.",
    "Access road watered twice to keep the dust down.",
]

MATERIAL_USAGE_NOTES = [
    "Issued to the block work gang.",
    "Drawn for the slab pour.",
    "Consumed in column casting.",
    "Issued against the plastering work order.",
    "Used on the podium level.",
    "Drawn for the retaining wall.",
]

SITE_ISSUE_TEMPLATES = [
    ("Rain stopped the podium pour", "Water collected in the shutter after the afternoon downpour. Pour rescheduled once the formwork is dried and re-checked.", "high", "Podium level, grid C4-C7"),
    ("Steel delivery short by 4 tonnes", "Supplier sent 14.2 tonnes against an order of 18.4. Balance promised within three days; column work resequenced meanwhile.", "high", "Site store"),
    ("Hoist out of service", "Material hoist tripped repeatedly under load. Electrician called; loads being moved by the tower crane in the interim.", "medium", "Block B core"),
    ("Honeycombing found in column C12", "Consultant flagged honeycombing at the base of C12 during inspection. Repair method statement submitted for approval.", "medium", "Second floor, grid C12"),
    ("Access road washed out", "The approach from the main gate is rutted after two days of rain. Transit mixers are struggling to reach the pump.", "medium", "Site approach road"),
    ("Scaffold handrail missing on level 6", "Safety walk found a missing handrail on the east elevation. Work in that bay stopped until it is reinstated.", "high", "Level 6, east elevation"),
]

WORKFORCE_NOTES = [
    "Full strength on site; no absentees.",
    "Two masons short, covered by the sub-contractor's gang.",
    "Extra bar benders brought in for the raft.",
    "Reduced crew — festival leave.",
    "Night shift kept on for the pour.",
]

MATERIAL_REQUEST_NOTES = [
    "Required before the next slab cycle starts.",
    "Current stock will run out in three working days.",
    "Needed for the plastering front on the lower floors.",
    "Ordered early because the lead time went up last month.",
]
