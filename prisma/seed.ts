import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import bcrypt from "bcryptjs";

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// Helper: date offset from now
const daysAgo = (d: number) => new Date(Date.now() - d * 24 * 60 * 60 * 1000);
const hoursAgo = (h: number) => new Date(Date.now() - h * 60 * 60 * 1000);

// Today at a given HH:MM (local midnight + offset)
function todayAt(hhmm: string): Date {
  const [hh, mm] = hhmm.split(":").map(Number);
  const d = new Date();
  d.setHours(hh, mm, 0, 0);
  return d;
}

// Date-only (no time) for scheduledDate fields typed as @db.Date
function dateOnly(d: Date): Date {
  return new Date(d.toISOString().split("T")[0] + "T00:00:00.000Z");
}

async function main() {
  const passwordHash = await bcrypt.hash("admin123", 10);

  // ── Staff ─────────────────────────────────────────────────────────────────

  await prisma.staff.upsert({
    where: { phone: "9999999999" },
    update: {},
    create: {
      name: "Admin",
      phone: "9999999999",
      passwordHash,
      role: "ADMIN",
    },
  });

  const drShah = await prisma.staff.upsert({
    where: { phone: "9999999001" },
    update: {},
    create: {
      name: "Dr. Shah",
      phone: "9999999001",
      passwordHash: await bcrypt.hash("doctor123", 10),
      role: "DOCTOR",
    },
  });

  const ravi = await prisma.staff.upsert({
    where: { phone: "9999999002" },
    update: {},
    create: {
      name: "Ravi (Paravet)",
      phone: "9999999002",
      passwordHash: await bcrypt.hash("paravet123", 10),
      role: "PARAVET",
    },
  });

  const priya = await prisma.staff.upsert({
    where: { phone: "9999999003" },
    update: {},
    create: {
      name: "Priya (Attendant)",
      phone: "9999999003",
      passwordHash: await bcrypt.hash("attendant123", 10),
      role: "ATTENDANT",
    },
  });

  // ── Cages ─────────────────────────────────────────────────────────────────

  const generalCages = ["G-01", "G-02", "G-03", "G-04", "G-05", "G-06", "G-07", "G-08"];
  const isoCages = ["ISO-01", "ISO-02", "ISO-03", "ISO-04"];
  const icuCages = ["ICU-01", "ICU-02"];

  for (const cage of generalCages) {
    await prisma.cageConfig.upsert({
      where: { ward_cageNumber: { ward: "GENERAL", cageNumber: cage } },
      update: {},
      create: { ward: "GENERAL", cageNumber: cage },
    });
  }
  for (const cage of isoCages) {
    await prisma.cageConfig.upsert({
      where: { ward_cageNumber: { ward: "ISOLATION", cageNumber: cage } },
      update: {},
      create: { ward: "ISOLATION", cageNumber: cage },
    });
  }
  for (const cage of icuCages) {
    await prisma.cageConfig.upsert({
      where: { ward_cageNumber: { ward: "ICU", cageNumber: cage } },
      update: {},
      create: { ward: "ICU", cageNumber: cage },
    });
  }

  console.log("Seed: staff + cages done");

  // ── Patient 1: Bruno (CRITICAL, General G-03) ────────────────────────────

  const bruno = await prisma.patient.create({
    data: {
      name: "Bruno",
      species: "DOG",
      breed: "Labrador Mix",
      age: "~3 years",
      weight: 24.5,
      sex: "MALE",
      isStray: true,
      admissions: {
        create: {
          admissionDate: daysAgo(3),
          ward: "GENERAL",
          cageNumber: "G-03",
          status: "ACTIVE",
          condition: "CRITICAL",
          diagnosis: "Tick Fever (Ehrlichiosis)",
          chiefComplaint: "High fever, lethargy, tick infestation",
          admittedById: drShah.id,
          attendingDoctor: drShah.name,

          // Clinical note
          clinicalNotes: {
            create: {
              category: "DOCTOR_ROUND",
              content: "Patient admitted with high fever and lethargy. Tick test positive. Starting anti-rickettsial therapy. Monitor closely.",
              recordedAt: daysAgo(3),
              recordedById: drShah.id,
            },
          },

          // Vitals: 2 records — abnormal then slightly better
          vitalRecords: {
            create: [
              {
                recordedAt: hoursAgo(24),
                temperature: 40.1,
                heartRate: 152,
                respRate: 36,
                painScore: 3,
                weight: 24.5,
                mucousMembraneColor: "Pale pink",
                notes: "Febrile, tachycardic. Very lethargic.",
                recordedById: ravi.id,
              },
              {
                recordedAt: hoursAgo(6),
                temperature: 39.6,
                heartRate: 138,
                respRate: 30,
                painScore: 2,
                weight: 24.3,
                mucousMembraneColor: "Pink",
                notes: "Slight improvement after first dose of Ceftriaxone.",
                recordedById: ravi.id,
              },
            ],
          },

          // Treatment plans
          treatmentPlans: {
            create: [
              {
                drugName: "Ceftriaxone",
                dose: "25 mg/kg",
                calculatedDose: "612.5 mg IV",
                route: "IV",
                frequency: "BID",
                scheduledTimes: ["08:00", "20:00"],
                startDate: daysAgo(3),
                isActive: true,
                createdById: drShah.id,
                administrations: {
                  create: [
                    {
                      scheduledDate: dateOnly(new Date()),
                      scheduledTime: "08:00",
                      wasAdministered: true,
                      actualTime: todayAt("08:10"),
                      administeredById: ravi.id,
                      notes: "Administered without issues.",
                    },
                    {
                      scheduledDate: dateOnly(new Date()),
                      scheduledTime: "20:00",
                      wasAdministered: false,
                    },
                  ],
                },
              },
              {
                drugName: "Meloxicam",
                dose: "0.1 mg/kg",
                calculatedDose: "2.45 mg IV",
                route: "IV",
                frequency: "SID",
                scheduledTimes: ["08:00"],
                startDate: daysAgo(3),
                isActive: true,
                createdById: drShah.id,
                administrations: {
                  create: [
                    {
                      scheduledDate: dateOnly(new Date()),
                      scheduledTime: "08:00",
                      wasAdministered: false,
                    },
                  ],
                },
              },
              {
                drugName: "Pantoprazole",
                dose: "1 mg/kg",
                calculatedDose: "24.5 mg IV",
                route: "IV",
                frequency: "SID",
                scheduledTimes: ["08:00"],
                startDate: daysAgo(3),
                isActive: true,
                createdById: drShah.id,
                administrations: {
                  create: [
                    {
                      scheduledDate: dateOnly(new Date()),
                      scheduledTime: "08:00",
                      wasAdministered: false,
                    },
                  ],
                },
              },
            ],
          },

          // Diet plan
          dietPlans: {
            create: {
              dietType: "Soft recovery diet",
              instructions: "Soft, easily digestible food. Small frequent meals.",
              isActive: true,
              createdById: drShah.id,
              feedingSchedules: {
                create: [
                  {
                    scheduledTime: "08:00",
                    foodType: "Soft recovery diet",
                    portion: "200g",
                    feedingLogs: {
                      create: {
                        date: dateOnly(new Date()),
                        status: "EATEN",
                        amountConsumed: "200g",
                        loggedById: priya.id,
                      },
                    },
                  },
                  {
                    scheduledTime: "14:00",
                    foodType: "Soft recovery diet",
                    portion: "200g",
                    feedingLogs: {
                      create: {
                        date: dateOnly(new Date()),
                        status: "PENDING",
                        loggedById: priya.id,
                      },
                    },
                  },
                  {
                    scheduledTime: "20:00",
                    foodType: "Soft recovery diet",
                    portion: "200g",
                    feedingLogs: {
                      create: {
                        date: dateOnly(new Date()),
                        status: "PENDING",
                        loggedById: priya.id,
                      },
                    },
                  },
                ],
              },
            },
          },

          // Bath log: 6 days ago (overdue)
          bathLogs: {
            create: {
              bathedAt: daysAgo(6),
              bathedById: priya.id,
              notes: "Tick bath on admission. Anti-parasitic shampoo used.",
            },
          },
        },
      },
    },
  });

  console.log("Seed: Bruno created", bruno.id);

  // ── Patient 2: Chhotu (STABLE, General G-01) ─────────────────────────────

  const chhotu = await prisma.patient.create({
    data: {
      name: "Chhotu",
      species: "DOG",
      breed: "Indian Pariah",
      age: "~2 years",
      weight: 18,
      sex: "MALE",
      isStray: true,
      admissions: {
        create: {
          admissionDate: daysAgo(5),
          ward: "GENERAL",
          cageNumber: "G-01",
          status: "ACTIVE",
          condition: "STABLE",
          diagnosis: "Post-op (splenectomy)",
          chiefComplaint: "Splenic mass — emergency splenectomy performed",
          admittedById: drShah.id,
          attendingDoctor: drShah.name,

          vitalRecords: {
            create: [
              {
                recordedAt: hoursAgo(8),
                temperature: 38.6,
                heartRate: 88,
                respRate: 22,
                painScore: 1,
                weight: 17.8,
                mucousMembraneColor: "Pink",
                notes: "Stable post-op. Wound healing well.",
                recordedById: ravi.id,
              },
            ],
          },

          treatmentPlans: {
            create: [
              {
                drugName: "Amoxicillin-Clavulanate",
                dose: "20 mg/kg",
                calculatedDose: "360 mg PO",
                route: "PO",
                frequency: "BID",
                scheduledTimes: ["08:00", "20:00"],
                startDate: daysAgo(5),
                isActive: true,
                createdById: drShah.id,
                administrations: {
                  create: [
                    {
                      scheduledDate: dateOnly(new Date()),
                      scheduledTime: "08:00",
                      wasAdministered: true,
                      actualTime: todayAt("08:15"),
                      administeredById: ravi.id,
                    },
                    {
                      scheduledDate: dateOnly(new Date()),
                      scheduledTime: "20:00",
                      wasAdministered: false,
                    },
                  ],
                },
              },
            ],
          },

          dietPlans: {
            create: {
              dietType: "Boiled chicken + rice",
              instructions: "Plain boiled chicken with rice. No fat, no seasoning.",
              isActive: true,
              createdById: drShah.id,
              feedingSchedules: {
                create: [
                  {
                    scheduledTime: "08:00",
                    foodType: "Boiled chicken + rice",
                    portion: "150g",
                    feedingLogs: {
                      create: {
                        date: dateOnly(new Date()),
                        status: "EATEN",
                        amountConsumed: "150g",
                        loggedById: priya.id,
                      },
                    },
                  },
                  {
                    scheduledTime: "14:00",
                    foodType: "Boiled chicken + rice",
                    portion: "150g",
                    feedingLogs: {
                      create: {
                        date: dateOnly(new Date()),
                        status: "PENDING",
                        loggedById: priya.id,
                      },
                    },
                  },
                  {
                    scheduledTime: "20:00",
                    foodType: "Boiled chicken + rice",
                    portion: "150g",
                    feedingLogs: {
                      create: {
                        date: dateOnly(new Date()),
                        status: "PENDING",
                        loggedById: priya.id,
                      },
                    },
                  },
                ],
              },
            },
          },

          // Bath log: 3 days ago (not yet due)
          bathLogs: {
            create: {
              bathedAt: daysAgo(3),
              bathedById: priya.id,
              notes: "Routine bath. Surgical wound protected with waterproof dressing.",
            },
          },
        },
      },
    },
  });

  console.log("Seed: Chhotu created", chhotu.id);

  // ── Patient 3: Lali (IMPROVING, General G-05) ────────────────────────────

  const lali = await prisma.patient.create({
    data: {
      name: "Lali",
      species: "DOG",
      breed: "Indian Pariah",
      age: "~1 year",
      weight: 12,
      sex: "FEMALE",
      isStray: true,
      admissions: {
        create: {
          admissionDate: daysAgo(2),
          ward: "GENERAL",
          cageNumber: "G-05",
          status: "ACTIVE",
          condition: "IMPROVING",
          diagnosis: "Dehydration + Malnutrition",
          chiefComplaint: "Emaciated, dehydrated stray found collapsed on road",
          admittedById: drShah.id,
          attendingDoctor: drShah.name,

          vitalRecords: {
            create: [
              {
                recordedAt: hoursAgo(12),
                temperature: 38.4,
                heartRate: 96,
                respRate: 24,
                painScore: 1,
                weight: 12.0,
                mucousMembraneColor: "Pale pink",
                notes: "Improving with fluid therapy. Still weak but alert.",
                recordedById: ravi.id,
              },
            ],
          },

          treatmentPlans: {
            create: [
              {
                drugName: "Vitamin B Complex",
                dose: "1 ml/10 kg",
                calculatedDose: "1.2 ml IM",
                route: "IM",
                frequency: "SID",
                scheduledTimes: ["08:00"],
                startDate: daysAgo(2),
                isActive: true,
                createdById: drShah.id,
                administrations: {
                  create: [
                    {
                      scheduledDate: dateOnly(new Date()),
                      scheduledTime: "08:00",
                      wasAdministered: true,
                      actualTime: todayAt("08:20"),
                      administeredById: ravi.id,
                    },
                  ],
                },
              },
            ],
          },

          fluidTherapies: {
            create: {
              fluidType: "Ringer's Lactate (RL)",
              rate: "40 ml/hr",
              additives: "None",
              startTime: daysAgo(2),
              isActive: true,
              notes: "Maintenance + deficit replacement.",
              createdById: drShah.id,
            },
          },

          dietPlans: {
            create: {
              dietType: "High-calorie gruel (syringe feed)",
              instructions: "Syringe feed every 4 hours. 20-30 ml per feed. Warm to body temperature.",
              isActive: true,
              createdById: drShah.id,
              feedingSchedules: {
                create: [
                  {
                    scheduledTime: "08:00",
                    foodType: "High-calorie gruel",
                    portion: "25ml syringe",
                    feedingLogs: {
                      create: {
                        date: dateOnly(new Date()),
                        status: "EATEN",
                        amountConsumed: "25ml",
                        notes: "Accepted well.",
                        loggedById: priya.id,
                      },
                    },
                  },
                  {
                    scheduledTime: "12:00",
                    foodType: "High-calorie gruel",
                    portion: "25ml syringe",
                    feedingLogs: {
                      create: {
                        date: dateOnly(new Date()),
                        status: "PARTIAL",
                        amountConsumed: "15ml",
                        notes: "Accepted partially.",
                        loggedById: priya.id,
                      },
                    },
                  },
                  {
                    scheduledTime: "16:00",
                    foodType: "High-calorie gruel",
                    portion: "25ml syringe",
                    feedingLogs: {
                      create: {
                        date: dateOnly(new Date()),
                        status: "PENDING",
                        loggedById: priya.id,
                      },
                    },
                  },
                  {
                    scheduledTime: "20:00",
                    foodType: "High-calorie gruel",
                    portion: "25ml syringe",
                    feedingLogs: {
                      create: {
                        date: dateOnly(new Date()),
                        status: "PENDING",
                        loggedById: priya.id,
                      },
                    },
                  },
                ],
              },
            },
          },

          // No bath logged — bath due from admission date
        },
      },
    },
  });

  console.log("Seed: Lali created", lali.id);

  // ── Patient 4: Golu (GUARDED, Isolation ISO-01) ──────────────────────────

  const golu = await prisma.patient.create({
    data: {
      name: "Golu",
      species: "DOG",
      breed: "Indian Pariah Puppy",
      age: "~6 months",
      weight: 4.5,
      sex: "MALE",
      isStray: true,
      admissions: {
        create: {
          admissionDate: daysAgo(2),
          ward: "ISOLATION",
          cageNumber: "ISO-01",
          status: "ACTIVE",
          condition: "GUARDED",
          diagnosis: "Canine Distemper (CDV)",
          chiefComplaint: "Nasal discharge, coughing, lethargy, neurological signs",
          admittedById: drShah.id,
          attendingDoctor: drShah.name,

          clinicalNotes: {
            create: {
              category: "DOCTOR_ROUND",
              content: "CDV PCR positive. Started isolation protocol. Supportive therapy initiated. Prognosis guarded due to neurological involvement.",
              recordedAt: daysAgo(2),
              recordedById: drShah.id,
            },
          },

          vitalRecords: {
            create: [
              {
                recordedAt: hoursAgo(10),
                temperature: 39.8,
                heartRate: 148,
                respRate: 42,
                painScore: 2,
                weight: 4.5,
                mucousMembraneColor: "Pale",
                notes: "Febrile. Mucopurulent nasal discharge. Mild tremors noted.",
                recordedById: ravi.id,
              },
            ],
          },

          treatmentPlans: {
            create: [
              {
                drugName: "Ceftriaxone",
                dose: "25 mg/kg",
                calculatedDose: "112.5 mg IV",
                route: "IV",
                frequency: "BID",
                scheduledTimes: ["08:00", "20:00"],
                startDate: daysAgo(2),
                isActive: true,
                createdById: drShah.id,
                administrations: {
                  create: [
                    {
                      scheduledDate: dateOnly(new Date()),
                      scheduledTime: "08:00",
                      wasAdministered: true,
                      actualTime: todayAt("08:05"),
                      administeredById: ravi.id,
                    },
                    {
                      scheduledDate: dateOnly(new Date()),
                      scheduledTime: "20:00",
                      wasAdministered: false,
                    },
                  ],
                },
              },
              {
                drugName: "Nebulization (N-Saline)",
                dose: "3 ml",
                calculatedDose: "3 ml via nebulizer",
                route: "NEBULIZER",
                frequency: "TID",
                scheduledTimes: ["08:00", "14:00", "20:00"],
                startDate: daysAgo(2),
                isActive: true,
                notes: "10 minutes per session.",
                createdById: drShah.id,
                administrations: {
                  create: [
                    {
                      scheduledDate: dateOnly(new Date()),
                      scheduledTime: "08:00",
                      wasAdministered: true,
                      actualTime: todayAt("08:30"),
                      administeredById: ravi.id,
                    },
                    {
                      scheduledDate: dateOnly(new Date()),
                      scheduledTime: "14:00",
                      wasAdministered: false,
                    },
                    {
                      scheduledDate: dateOnly(new Date()),
                      scheduledTime: "20:00",
                      wasAdministered: false,
                    },
                  ],
                },
              },
            ],
          },

          labResults: {
            create: {
              testType: "PCR",
              testName: "CDV PCR (Canine Distemper Virus)",
              result: "Positive",
              resultDate: daysAgo(2),
              isAbnormal: true,
              notes: "CDV PCR strongly positive. Isolation mandatory.",
              createdById: drShah.id,
            },
          },

          isolationProtocol: {
            create: {
              disease: "Canine Distemper (CDV)",
              pcrStatus: "Positive",
              lastPcrDate: daysAgo(2),
              ppeRequired: ["Gloves", "Gown", "Shoe covers", "Hand sanitize on exit"],
              disinfectant: "Quaternary ammonium compound",
              disinfectionInterval: "Q4H",
              biosecurityNotes: "Dedicated equipment for this cage. No contact with other patients. Change PPE before and after entering iso ward.",
              isCleared: false,
              createdById: drShah.id,
              disinfectionLogs: {
                create: [
                  {
                    performedAt: hoursAgo(7),
                    performedById: priya.id,
                    notes: "Full cage disinfection with QAC solution.",
                  },
                  {
                    performedAt: hoursAgo(3),
                    performedById: ravi.id,
                    notes: "Routine Q4H disinfection. Floor, walls, food bowl cleaned.",
                  },
                ],
              },
            },
          },
        },
      },
    },
  });

  console.log("Seed: Golu created", golu.id);

  // ── Patient 5: Pappu (REGISTERED — no clinical setup) ────────────────────

  const pappu = await prisma.patient.create({
    data: {
      name: "Pappu",
      species: "CAT",
      breed: "Indian Domestic Cat",
      age: "~1 year",
      weight: 3.0,
      sex: "UNKNOWN",
      isStray: true,
      admissions: {
        create: {
          admissionDate: new Date(),
          status: "REGISTERED",
          admittedById: drShah.id,
          chiefComplaint: "Found injured near road. Awaiting clinical assessment.",
        },
      },
    },
  });

  console.log("Seed: Pappu created", pappu.id);

  console.log(
    "\nSeed complete: 4 staff + 14 cages + 5 patients (Bruno, Chhotu, Lali, Golu, Pappu)"
  );
  console.log("  - Bruno  : ACTIVE / GENERAL G-03 / CRITICAL  — Tick Fever");
  console.log("  - Chhotu : ACTIVE / GENERAL G-01 / STABLE    — Post-op splenectomy");
  console.log("  - Lali   : ACTIVE / GENERAL G-05 / IMPROVING — Dehydration + Malnutrition");
  console.log("  - Golu   : ACTIVE / ISOLATION ISO-01 / GUARDED — Canine Distemper (CDV)");
  console.log("  - Pappu  : REGISTERED (pending clinical setup)");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
