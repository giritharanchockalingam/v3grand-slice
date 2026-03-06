// ─── MCP Tools: Legal compliance (RERA, zoning, environmental, land title) ────
import { z } from 'zod';

/** State-wise RERA Rules (FY2024-25) */
const RERA_RULES_BY_STATE = {
  Maharashtra: {
    regulator: 'MahaRERA',
    carpetAreaDefinition: 'Carpet area as per RERA Act 2016',
    builderObligations: [
      'RERA registration mandatory for all projects >500 sqm',
      'Quarterly project status updates to homebuyers',
      'Escrow account: 70% of funds for construction',
      'Defect liability period: 5 years from completion',
    ],
    timeline: 'Registration within 7 days of project approval',
  },
  Goa: {
    regulator: 'Goa RERA',
    carpetAreaDefinition: 'Built-up area excluding common areas',
    builderObligations: [
      'RERA registration mandatory',
      'Monthly transparency reports',
      'Escrow: 70% funds protection',
      'Completion guarantee or insurance',
    ],
    timeline: 'Registration within 30 days of approval',
  },
  Karnataka: {
    regulator: 'RERA, Bangalore Development Authority',
    carpetAreaDefinition: 'Super built-up area as agreed',
    builderObligations: [
      'RERA registration required',
      'Site inspection reports every quarter',
      'Escrow: 70% funds in designated bank account',
      'Insurance cover for structural defects',
    ],
    timeline: 'Registration within 10 days of approval',
  },
  TamilNadu: {
    regulator: 'Tamil Nadu RERA',
    carpetAreaDefinition: 'Carpet area as per RERA definition',
    builderObligations: [
      'RERA registration for projects >500 sqm',
      'Bi-monthly buyer updates',
      'Escrow: 75% funds (higher than other states)',
      'Performance guarantee from bank/insurer',
    ],
    timeline: 'Registration within 14 days of approval',
  },
  Rajasthan: {
    regulator: 'Rajasthan RERA',
    carpetAreaDefinition: 'As per RERA Act 2016',
    builderObligations: [
      'Mandatory RERA registration',
      'Site inspection quarterly',
      'Escrow: 70% funds in developer/bank control',
      'Completion bond mandatory',
    ],
    timeline: 'Registration within 30 days',
  },
  'Delhi-NCR': {
    regulator: 'Delhi, Haryana, Uttar Pradesh RERA',
    carpetAreaDefinition: 'Carpet area excluding balconies, common areas',
    builderObligations: [
      'RERA registration mandatory for all projects',
      'Monthly project status updates',
      'Escrow: 70% funds held in separate account',
      'Insurance cover for latent defects',
    ],
    timeline: 'Registration within 14 days',
  },
  Kerala: {
    regulator: 'Kerala RERA',
    carpetAreaDefinition: 'Built-up area as agreed',
    builderObligations: [
      'RERA registration for >500 sqm projects',
      'Tri-monthly updates to buyers',
      'Escrow: 70% funds protection',
      'Defect warranty: 10 years structural, 3 years non-structural',
    ],
    timeline: 'Registration within 7 days of completion',
  },
} as const;

/** Indian Zoning Categories */
const ZONING_CATEGORIES = {
  RESIDENTIAL: {
    category: 'Residential',
    description: 'Single-family homes, apartments, housing societies',
    fsiRange: [1.0, 3.0],
    heightRestriction: '20-50 meters depending on zone',
    setback: {
      road: '3-10 meters',
      rear: '3-6 meters',
      sides: '2-5 meters',
    },
    parking: '1 space per 100 sqm built-up',
  },
  COMMERCIAL: {
    category: 'Commercial',
    description: 'Offices, retail shops, markets',
    fsiRange: [2.0, 5.0],
    heightRestriction: '30-70 meters depending on zone',
    setback: {
      road: '5-15 meters',
      rear: '5-10 meters',
      sides: '3-7 meters',
    },
    parking: '1 space per 50 sqm built-up',
  },
  HOSPITALITY: {
    category: 'Hospitality',
    description: 'Hotels, resorts, guest houses',
    fsiRange: [1.5, 4.0],
    heightRestriction: '40-80 meters (often highest)',
    setback: {
      road: '10-20 meters',
      rear: '10-15 meters',
      sides: '5-10 meters',
    },
    parking: '1 space per 2 rooms + 1 per 75 sqm public area',
  },
  MIXED_USE: {
    category: 'Mixed-Use',
    description: 'Residential + commercial on same plot',
    fsiRange: [2.5, 4.5],
    heightRestriction: '50-80 meters',
    setback: {
      road: '7-15 meters',
      rear: '5-10 meters',
      sides: '4-8 meters',
    },
    parking: '1 space per 75 sqm built-up (mixed)',
  },
} as const;

/** CRZ (Coastal Regulation Zone) Classifications */
const CRZ_ZONES = {
  CRZ_I: 'No development allowed (high tide line to 500m inland)',
  CRZ_II: 'Development allowed only on already developed land',
  CRZ_III: 'Regulated development allowed (500m to 2km inland)',
  CRZ_IV: 'Backwaters, creeks, lagoons - restricted development',
} as const;

/** EIA Notification Thresholds (India) */
const EIA_THRESHOLDS = {
  BUILDING: 20000, // sqm
  RESORT_HOTEL: 50000, // sqm
  AMUSEMENT_PARKS: 25000, // sqm
} as const;

/** Parking Norms by City */
const PARKING_NORMS = {
  residential_per_sqm: 1 / 75,
  commercial_per_sqm: 1 / 50,
  hospitality_rooms: 1 / 2,
  hospitality_public_area: 1 / 75,
} as const;

/** Register legal tools on an MCP server. */
export function registerLegalTools(
  server: {
    registerTool(
      name: string,
      inputSchema: z.ZodType,
      handler: (args: unknown) => Promise<{ content: Array<{ type: 'text'; text: string }> }>,
    ): void;
  },
  context: { db: any },
): void {
  server.registerTool(
    'check_rera_compliance',
    z.object({
      dealId: z.string().describe('Deal ID'),
      state: z.string().optional().describe('State name (e.g., Maharashtra, Goa, Karnataka)'),
    }),
    async (args) => {
      const { dealId, state = 'Maharashtra' } = args as { dealId: string; state?: string };

      const stateRules = RERA_RULES_BY_STATE[state as keyof typeof RERA_RULES_BY_STATE] || RERA_RULES_BY_STATE.Maharashtra;

      // Simulated deal data
      const dealData = {
        projectName: 'Grand Hotel Resort',
        projectArea: 125000, // sqm
        estimatedCost: 500000000, // ₹50Cr
        numberOfUnits: 150,
        completionTimeline: 36, // months
      };

      const compliance = {
        dealId,
        state,
        regulator: stateRules.regulator,
        registrationRequirements: {
          mandatoryRegistration: 'Yes - Project area >500 sqm',
          registrationDeadline: stateRules.timeline,
          documentsRequired: [
            'Title deed & encumbrance certificate',
            'Architectural plans and approvals',
            'Environmental clearance (if required)',
            'Project cost estimate breakdown',
            'Promoter financial credentials',
            'Insurance policy copy',
            'Escrow account agreement',
          ],
          registrationFee: 'Typically ₹5,000 - ₹10,000',
          validity: '5 years from registration',
        },
        builderObligations: stateRules.builderObligations,
        escrowAccountRequirements: {
          mandatoryEscrow: true,
          escrowPercentage: '70% of buyer payments',
          accountHolder: 'Designated bank in joint names',
          releaseConditions: [
            'Foundation stage completion',
            'Plinth level completion',
            '50% construction completion',
            '75% construction completion',
            'Substantial completion (OC)',
          ],
          penalties: 'Non-compliance: ₹5,000-25,000 daily or 10% refund',
        },
        timelineCompliance: {
          projectCompletionDeadline: '36 months from registration',
          delayPenalty: 'Interest at SBI base rate + 2% per annum',
          buyerCompensation: '₹100-500 per sqm per month of delay',
        },
        buyerProtections: [
          'Refund within 45 days if project cancelled',
          'Defect liability period: 5 years',
          'Insurance cover for latent defects',
          'Redressal mechanism for complaints',
        ],
        penalties: {
          unregisteredProject: '₹10,00,000 + imprisonment up to 3 years',
          misrepresentation: 'Imprisonment up to 5 years + fine',
          delayInCompletion: 'SBI repo rate + 2% on refund amount',
        },
        recommendations: [
          'Register project within statutory timeline',
          'Establish escrow account before presales',
          'Maintain construction timeline and milestones',
          'Update buyers quarterly on project status',
          'Obtain insurance for structural defects',
          'Comply with fire, safety, and environmental NOCs',
        ],
        sources: [
          'Real Estate (Regulation and Development) Act, 2016',
          f'{state} RERA Rules and Regulations',
          'Central RERA Authority Guidelines',
          'RERA Telecom Portal (rera.trai.gov.in)',
        ],
      };

      return {
        content: [{ type: 'text', text: JSON.stringify(compliance, null, 2) }],
      };
    },
  );

  server.registerTool(
    'check_zoning',
    z.object({ dealId: z.string().describe('Deal ID for zoning analysis') }),
    async (args) => {
      const { dealId } = args as { dealId: string };

      // Simulated deal data
      const dealData = {
        projectName: 'Grand Hotel Resort',
        plotArea: 50000, // sqm
        proposedBuiltUp: 80000, // sqm
        proposedHeight: 75, // meters
        roadSetback: 20, // meters
        rearSetback: 15, // meters
        sideSetback: 8, // meters
        proposedZone: 'Hospitality',
      };

      const hospitality = ZONING_CATEGORIES.HOSPITALITY;
      const fsi = dealData.proposedBuiltUp / dealData.plotArea;
      const fsiCompliant = fsi >= hospitality.fsiRange[0] && fsi <= hospitality.fsiRange[1];

      // Calculate parking requirement
      const estimatedRooms = 150;
      const publicAreaSqm = 20000; // conference, restaurants, etc.
      const requiredParking =
        estimatedRooms * PARKING_NORMS.hospitality_rooms +
        publicAreaSqm * PARKING_NORMS.hospitality_public_area;

      const analysis = {
        dealId,
        projectDetails: dealData,
        proposedZoneCategory: proposedZone,
        zoneDetails: hospitality,
        complianceAnalysis: {
          fsi: {
            proposed: fsi.toFixed(2),
            permittedRange: hospitality.fsiRange,
            compliant: fsiCompliant,
            status: fsiCompliant ? 'COMPLIANT' : 'NON-COMPLIANT',
          },
          height: {
            proposed: `${dealData.proposedHeight}m`,
            restriction: hospitality.heightRestriction,
            compliant: true, // Assuming within limit
            status: 'COMPLIANT',
          },
          setbacks: {
            roadSetback: {
              proposed: dealData.roadSetback,
              required: hospitality.setback.road,
              compliant: dealData.roadSetback >= parseInt(hospitality.setback.road),
            },
            rearSetback: {
              proposed: dealData.rearSetback,
              required: hospitality.setback.rear,
              compliant: dealData.rearSetback >= parseInt(hospitality.setback.rear),
            },
            sideSetback: {
              proposed: dealData.sideSetback,
              required: hospitality.setback.sides,
              compliant: dealData.sideSetback >= parseInt(hospitality.setback.sides),
            },
          },
          parking: {
            required: Math.ceil(requiredParking),
            norm: 'Hospitality: 1 space per 2 rooms + 1 per 75 sqm public area',
            status: 'To be verified on detailed design',
          },
          greenArea: {
            requirement: '20-30% of plot area',
            minimum: dealData.plotArea * 0.2,
            status: 'To be verified in landscape plan',
          },
        },
        permittedUsages: [
          'Hotel/Resort operations',
          'Conference facilities',
          'Restaurants & bars',
          'Recreation facilities',
          'Ancillary retail (up to 15%)',
          'Staff accommodation (if applicable)',
        ],
        restrictedUsages: [
          'Residential apartments',
          'Industrial facilities',
          'Warehousing',
          'Noxious uses',
          'Polluting activities',
        ],
        procedureForApproval: [
          '1. Obtain zoning conformity certificate from municipal authority',
          '2. Prepare master plan complying with all setback/FSI norms',
          '3. Submit building plan with zoning compliance certificate',
          '4. Obtain municipal building approval (7-15 days typical)',
          '5. Obtain fire safety clearance',
          '6. Obtain sanitation/environmental clearance',
          '7. Obtain occupancy certificate upon completion',
        ],
        commonchallenges: [
          'FSI deviation (solutions: modification, higher authority appeal)',
          'Parking shortfall (solutions: underground parking, external arrangement)',
          'Setback encroachment (solutions: design revision, waiver application)',
          'Heritage/protected structure constraint (engage urban heritage cell)',
        ],
        sources: [
          'Development Control Rules (DCR) of respective municipal corporation',
          'Town Planning Scheme',
          'Master Plan of the city',
          'Unified Building Code (UBC) India',
          'National Building Code (NBC) India',
        ],
      };

      return {
        content: [{ type: 'text', text: JSON.stringify(analysis, null, 2) }],
      };
    },
  );

  server.registerTool(
    'get_environmental_clearances',
    z.object({ dealId: z.string().describe('Deal ID for environmental analysis') }),
    async (args) => {
      const { dealId } = args as { dealId: string };

      // Simulated deal data
      const dealData = {
        projectName: 'Grand Beachfront Hotel',
        projectArea: 125000, // sqm
        location: 'Goa (Coastal)',
        distanceFromCoast: 400, // meters
        waterTableDepth: 2.5, // meters
        proposedWaterUsage: 2000, // liters per day per room = 300,000 per day for 150 rooms
      };

      const eiaRequired = dealData.projectArea >= EIA_THRESHOLDS.RESORT_HOTEL;
      const crzZone = dealData.distanceFromCoast < 500 ? 'CRZ-II' : 'CRZ-III';
      const groundwaterImpact = dealData.waterTableDepth < 5;

      const analysis = {
        dealId,
        projectDetails: dealData,
        eia: {
          required: eiaRequired,
          threshold: `₹50,000 sqm for resort/hotel`,
          reason: eiaRequired ? 'Project area >50,000 sqm (hotel category)' : 'Project area <50,000 sqm',
          iaNotificationSection: 'EIA Notification 2006 (Schedule)',
          category: eiaRequired ? 'Category A (Central EIA approval)' : 'Category B (State approval)',
          timeline: eiaRequired ? '90-120 days' : '30-45 days',
          cost: eiaRequired ? '₹5-10 lakhs' : '₹1-2 lakhs',
        },
        coastalZoneCompliance: {
          location: dealData.location,
          crZone: crzZone,
          zoneDefinition: CRZ_ZONES[crzZone as keyof typeof CRZ_ZONES],
          regulations: [
            'CRZ Notification 2019 (Coastal Regulation Zones)',
            'Mandatory CRZ clearance from coastal authority (state)',
            'No polluting industry within 2 km of coast',
            'Minimum 500m from high tide line (varies by zone)',
          ],
          restrictionsCRZ_II: [
            'Development allowed only on already developed land',
            'No new residential development within 500m',
            'Tourism-related infrastructure on developed land allowed',
            'Setback from high tide line: 500m minimum',
            'Environmental clearance mandatory',
          ],
          approvals: [
            'CRZ clearance from State Coastal Zone Management Authority',
            'No Objection Certificate from fisheries department',
            'Beach Management Plan (if applicable)',
            'Mangrove/coral protection plan',
          ],
        },
        waterResourcesCompliance: {
          usagePattern: `${dealData.proposedWaterUsage.toLocaleString()} liters/day (150 rooms)`,
          benchmark: '500-1500 liters/occupied room/day (hotel standard)',
          groundwaterImpact: groundwaterImpact ? 'Moderate to High' : 'Low',
          requirements: [
            'Water audit report (baseline usage)',
            'Rainwater harvesting plan (minimum 30% of annual rainfall)',
            'STP (Sewage Treatment Plant) for wastewater',
            'ETP (Effluent Treatment Plant) if industrial-like discharge',
            'Water reuse certificate (ZLD feasibility)',
          ],
          stpCapacity: Math.ceil(dealData.proposedWaterUsage * 1.2 / 1000), // in MLD
          zwlTarget: 'Zero Liquid Discharge feasible for coastal property',
        },
        airQualityCompliance: {
          requirements: [
            'Baseline air quality study (NAPL methodology)',
            'Diesel generator stack approval (SPCB)',
            'Dust control measures during construction',
            'Annual air quality monitoring post-operation',
          ],
          restrictionOnDG: 'DG set use only for emergency; renewable energy preferred',
        },
        noiseCompliance: {
          limits: {
            residential_day: '55 dB(A)',
            residential_night: '45 dB(A)',
            commercial_day: '65 dB(A)',
            commercial_night: '55 dB(A)',
          },
          mitigations: [
            'Sound barrier walls around loudspeaker areas',
            'Noise baffle around outdoor areas',
            'HVAC insulation in guest rooms',
            'Curfew on entertainment noise (11pm-7am)',
          ],
        },
        greenBeltRequirements: {
          percentage: '20-30% of plot area',
          requiredArea: Math.ceil(dealData.projectArea * 0.25),
          speciesPreference: 'Native, salt-tolerant species in coastal zones',
          maintenancePlan: '30-year landscape management plan',
        },
        wasteManagement: {
          solidWaste: [
            'Segregation at source (organic/inorganic)',
            'Composting facility for organic waste',
            'Recycling of inorganic/plastic waste',
            'Hazardous waste (paint, oil) managed per rules',
          ],
          constructionWaste: [
            'Temporary waste storage with environmental controls',
            'Authorization for construction waste dump site',
            'Waste management plan for demolition/excavation',
          ],
        },
        wildlifeCompliance: {
          protectedSpecies: 'Check with Wildlife Board for coastal species',
          requirements: [
            'Wildlife clearance if within 2km of Protected Area',
            'Sea turtle protection plan (if applicable)',
            'Bird migration impact assessment',
          ],
        },
        approvalSequence: [
          '1. Preliminary EIA scoping (if required)',
          '2. Environmental Consultant engagement',
          '3. Baseline data collection (3-6 months)',
          '4. Draft EIA report preparation',
          '5. Public consultation & stakeholder feedback',
          '6. State Environmental Impact Assessment Authority review',
          '7. Environmental Clearance from SEAC/SEIAA',
          '8. CRZ Clearance from coastal authority (parallel)',
          '9. Other sectoral clearances (forestry, wildlife, etc.)',
        ],
        sources: [
          'EIA Notification 2006, S.O. 1533(E)',
          'CRZ Notification 2019 (as amended)',
          'MOEF&CC Environmental Clearance Guidelines',
          'State Pollution Control Board (SPCB) Standards',
          'Coastal Regulation Zone Management Rules (State)',
          'Wildlife Protection Act 1972',
          'Water Quality (Prevention & Control of Pollution) Act 1974',
        ],
      };

      return {
        content: [{ type: 'text', text: JSON.stringify(analysis, null, 2) }],
      };
    },
  );

  server.registerTool(
    'get_land_title_status',
    z.object({ dealId: z.string().describe('Deal ID for land title verification') }),
    async (args) => {
      const { dealId } = args as { dealId: string };

      // Simulated deal data
      const dealData = {
        plotSize: 50000, // sqm
        ownershipPeriod: 45, // years of ownership history available
        currentOwner: 'XYZ Developers Pvt Ltd',
        landUseHistory: 'Agricultural -> Commercial (conversion pending)',
      };

      const titleSearch = {
        dealId,
        overallStatus: 'Title search checklist',
        titleVerificationChecklist: [
          {
            item: '30-Year Title Chain',
            status: 'REQUIRED',
            description: 'Obtain Title Deeds for past 30 years (or since acquisition)',
            documents: ['Original Sale Deeds', 'Gift Deeds (if applicable)', 'Partition Deeds'],
            verificationPoints: [
              'Continuous ownership chain without gaps',
              'Signatures of all parties (buyer/seller/witness)',
              'Stamp duties paid on each deed',
              'No conflicting ownership claims during chain',
            ],
          },
          {
            item: 'Encumbrance Certificate (EC)',
            status: 'CRITICAL',
            description: 'Obtain EC from Sub-Registrar for last 30 years',
            period: '30 years',
            verificationPoints: [
              'No mortgages on property (except those being cleared)',
              'No court attachments or stay orders',
              'No rent control restrictions',
              'No disputes/lis pendens registered',
            ],
          },
          {
            item: 'Property Tax Clearance',
            status: 'REQUIRED',
            documents: ['Tax Assessment Order', 'Tax Payment Receipts (3 years)', 'Property Card from Municipal'],
            verificationPoints: [
              'No pending property tax arrears',
              'Current tax assessment is valid',
              'No property tax disputes',
            ],
          },
          {
            item: 'Conversion Certificate',
            status: dealData.landUseHistory.includes('Agricultural') ? 'CRITICAL' : 'N/A',
            description: 'Agricultural to Non-Agricultural conversion',
            requiredFrom: 'Agricultural Department / Deputy Registrar (for agricultural land)',
            verificationPoints: [
              'Conversion approval from competent authority',
              'Environmental clearance for conversion (if required)',
              'Revenue records updated post-conversion',
              'No restrictions on commercial use',
            ],
          },
          {
            item: 'Mutation/Name Transfer',
            status: 'REQUIRED',
            description: 'Property mutation in revenue records under current owner',
            requiredFrom: 'Tahsil / Revenue Department',
            verificationPoints: [
              'Mutation entry in revenue records',
              'Current owner name reflected in land records',
              'No conflicting mutations',
            ],
          },
          {
            item: 'Pending Litigation Check',
            status: 'CRITICAL',
            description: 'Verify no civil/criminal cases related to title',
            requiredFrom: 'District Court records & Police/Revenue authorities',
            verificationPoints: [
              'No lis pendens (pending litigation) registered',
              'No criminal cases against property/owner',
              'No partition suits in family',
            ],
          },
          {
            item: 'RERA Land Title Requirements',
            status: 'MANDATORY',
            description: 'RERA-specific title verification',
            documents: ['Title Compliance Certificate from advocate', 'No litigation certificate'],
            verificationPoints: [
              'Clear, marketable title confirmed by legal counsel',
              'No undisclosed encumbrances',
              'All statutory clearances obtained',
            ],
          },
        ],
        additionalVerifications: [
          {
            item: 'Municipal Compliance',
            status: 'REQUIRED',
            checks: [
              'Property on municipal map (no street widening risk)',
              'No unauthorised construction on property',
              'Regularization certificate if any structure',
            ],
          },
          {
            item: 'Heritage/Protected Structure',
            status: 'REQUIRED',
            checks: [
              'Not in heritage area (no restriction on development)',
              'Not a listed protected monument',
              'No archaeological significance',
            ],
          },
          {
            item: 'Flood Zone Assessment',
            status: 'REQUIRED',
            checks: [
              'Not in designated flood-prone zone',
              'No water logging history',
              'Adequate drainage access',
            ],
          },
          {
            item: 'Easement/Right of Way',
            status: 'REQUIRED',
            checks: [
              'No utility easements blocking development',
              'Power/water/sewer lines documented',
              'No public right of way through property',
            ],
          },
        ],
        timeline: {
          titleSearchDuration: '15-30 days',
          conversionApproval: '30-90 days (agricultural land)',
          rearaCompliance: '45-60 days from title clearance',
          totalPreApprovalTimeline: '90-150 days',
        },
        commonDefects: [
          'Unclear title chain (missing deeds)',
          'Unresolved partition disputes',
          'Mortgage not cleared from previous owner',
          'Pending court cases or lis pendens',
          'Conversion not completed (agricultural land)',
          'Encroachment from neighboring property',
          'Municipal restrictions (street widening, etc.)',
        ],
        remediationApproach: [
          'Obtain title insurance for unresolved minor defects',
          'Court orders for specific performance to clear title',
          'Agreement for sale with undertaking to clear defects',
          'Escrow hold-back until title issues resolved',
        ],
        sources: [
          'Indian Registration Act 1908 (Land Registration)',
          'Transfer of Property Act 1882',
          'Land Survey Act 1870 (Land Records)',
          'State Land Revenue Codes',
          'Real Estate (Regulation and Development) Act 2016 (RERA Title Requirements)',
          'RERA State-wise Rules',
        ],
      };

      return {
        content: [{ type: 'text', text: JSON.stringify(titleSearch, null, 2) }],
      };
    },
  );

  server.registerTool(
    'get_regulatory_requirements',
    z.object({ dealId: z.string().describe('Deal ID for regulatory checklist') }),
    async (args) => {
      const { dealId } = args as { dealId: string };

      // Simulated deal data
      const dealData = {
        projectName: 'Grand Hotel Resort',
        location: 'Bengaluru',
        numberOfRooms: 150,
        hasRestaurant: true,
        hasSpa: true,
        nearAirport: true,
        distanceFromAirport: 12, // km
      };

      const checklist = {
        dealId,
        projectDetails: dealData,
        regulatoryRequirements: [
          {
            requirement: 'Building Plan Approval',
            authority: 'Municipal Corporation / BMRDA (Bengaluru)',
            timeline: '7-15 days standard / 15-30 days detailed review',
            documents: [
              'Architect-designed master plan',
              'Structural design clearance',
              'Soil investigation report',
              'Title Deed & Mutation',
              'Zoning conformity certificate',
              'Environmental clearance (if >20,000 sqm)',
            ],
            cost: '₹2-5 lakhs',
            status: 'CRITICAL - Precondition for construction start',
          },
          {
            requirement: 'Fire NOC (Fire Safety Certificate)',
            authority: 'Fire Department / Chief Fire Officer',
            timeline: '30-45 days after structural completion',
            documents: [
              'Building plan with fire safety features',
              'Fire extinguisher specification',
              'Emergency exit layout',
              'Fire hydrant installation proof',
              'Fire alarm system certification',
            ],
            requirements: [
              'Fire exits: Min 2 per floor (staircase distance <30m)',
              'Fire extinguishers: 1 per 100 sqm',
              'Fire hydrants: 1 per 200 sqm + external supply',
              'Sprinkler system in high-occupancy areas',
              'Emergency lighting throughout',
            ],
            cost: '₹5-15 lakhs (for 150-room hotel)',
            status: 'CRITICAL - Mandatory before occupancy',
          },
          {
            requirement: 'Environmental Clearance',
            authority: 'SEIAA (State Environmental Impact Assessment Authority)',
            timeline: eiaRequired => '90-120 days (if EIA required) OR 30-45 days (screening exemption)',
            documents: [
              'EIA report (if category A/B1)',
              'Public consultation feedback',
              'Baseline environmental data',
              'Waste management plan',
            ],
            status: dealData.numberOf > 20000 ? 'CRITICAL' : 'CONDITIONAL',
          },
          {
            requirement: 'Height Clearance (AAI)',
            authority: 'Airports Authority of India (AAI)',
            timeline: '15-30 days',
            applicable: dealData.nearAirport && dealData.distanceFromAirport < 20,
            documents: [
              'Building design with height specification',
              'Topographical survey',
              'Obstacle chart submission',
            ],
            status: dealData.nearAirport ? 'CRITICAL' : 'NOT APPLICABLE',
            note: 'Required if within 20km of airport; height >100m requires AAI clearance',
          },
          {
            requirement: 'Tourism License',
            authority: 'Department of Tourism / Hotel Regulatory Authority',
            timeline: '30-60 days post-construction',
            documents: [
              'Building completion certificate',
              'Fire NOC',
              'Sanitation certificate',
              'Minimum amenity certification',
            ],
            categories: ['3-Star', '4-Star', '5-Star', 'Budget'],
            cost: '₹50,000-2,00,000 (one-time)',
            status: 'REQUIRED',
          },
          {
            requirement: 'FSSAI License (Food Safety)',
            authority: 'Food Safety & Standards Authority of India (FSSAI)',
            timeline: '15-30 days post-construction',
            applicable: dealData.hasRestaurant,
            documents: [
              'Kitchen design plans (layout, equipment)',
              'Certificate of occupancy',
              'Training certificate (food handlers)',
              'Lab test results (water quality)',
            ],
            status: dealData.hasRestaurant ? 'REQUIRED' : 'NOT APPLICABLE',
          },
          {
            requirement: 'Excise License (Alcohol)',
            authority: 'State Excise Department',
            timeline: '60-90 days',
            applicable: dealData.hasRestaurant, // Assuming alcohol service
            documents: [
              'Bar/lounge design plan',
              'No-objection from police',
              'Residential area distance affidavit (>100m)',
              'Public clearance affidavit',
            ],
            cost: '₹1-5 lakhs (annual renewal)',
            status: dealData.hasRestaurant ? 'REQUIRED' : 'NOT APPLICABLE',
          },
          {
            requirement: 'Pollution Control Board Consent',
            authority: 'State Pollution Control Board (SPCB)',
            timeline: '45-60 days',
            documents: [
              'DG set specification & location plan',
              'STP design details',
              'Air quality management plan',
              'Noise control measures',
            ],
            status: 'CRITICAL',
          },
          {
            requirement: 'Water Connection & Sanction',
            authority: 'Municipal Water Supply Authority / BWSSB (Bengaluru)',
            timeline: '30-45 days',
            documents: [
              'Water requirement certificate',
              'STP layout plan',
              'Rainwater harvesting plan',
              'No-objection from water authority',
            ],
            status: 'REQUIRED',
          },
          {
            requirement: 'Electricity Connection & Load Approval',
            authority: 'Power Distribution Company (BESCOM in Bengaluru)',
            timeline: '15-30 days',
            documents: [
              'Electrical design & load calculation',
              'DG set capacity specification',
              'Solar system plan (if renewable)',
            ],
            status: 'REQUIRED',
          },
          {
            requirement: 'Occupancy Certificate (OC)',
            authority: 'Municipal Commissioner / Building Control',
            timeline: '7-15 days post-completion inspection',
            documents: [
              'Completion certificate from architect',
              'Fire NOC',
              'Sanitation clearance',
              'Structural stability report',
            ],
            status: 'CRITICAL - Permits operation',
          },
          {
            requirement: 'Registration Under GST',
            authority: 'GST Jurisdiction Office',
            timeline: '7-10 days',
            documents: ['PAN', 'Building approval', 'Owner ID proof'],
            status: 'REQUIRED',
          },
          {
            requirement: 'Labour Department Registration',
            authority: 'State Labour Department',
            timeline: '15 days',
            documents: [
              'Estimated workforce details',
              'Workplace safety policy',
            ],
            status: 'REQUIRED (if >10 employees)',
          },
          {
            requirement: 'State Tourism Board Approvals (State-specific)',
            authority: 'State Tourism Development Board',
            timeline: '30-45 days',
            documents: ['Building plan', 'Fire NOC', 'Environmental clearance'],
            benefit: 'Tax incentives, funding eligibility',
            status: 'RECOMMENDED',
          },
        ],
        sequenceOfApprovals: [
          '1. Land Title Clearance (90-150 days)',
          '2. Environmental Clearance (if EIA required: 90-120 days)',
          '3. Building Plan Approval (7-30 days)',
          '4. Height Clearance from AAI (if applicable: 15-30 days)',
          '5. Construction Commencement (with Building Inspector sign-off)',
          '6. STP/Water Connection Approval (30-45 days)',
          '7. Power Load Sanction (15-30 days)',
          '8. Halfway inspections (fire, safety at plinth/50%/75%)',
          '9. Fire NOC Post-Completion (30-45 days)',
          '10. Environmental Compliance Certificate (15-30 days)',
          '11. Pollution Control Consent (45-60 days)',
          '12. Occupancy Certificate (7-15 days)',
          '13. Tourism License (30-60 days)',
          '14. FSSAI/Excise Licenses (15-90 days)',
          '15. GST & Labour Registration (7-30 days)',
        ],
        timelineEstimate: {
          preConstruction: '150-200 days',
          construction: '24-36 months (150-room hotel)',
          postConstruction: '90-120 days',
          totalProject: '3-3.5 years',
        },
        commonApprovalChallenges: [
          'Environmental impact objections (public hearings required)',
          'Height restrictions near airports',
          'Water availability constraints',
          'Fire safety plan revisions',
          'Parking norm compliance',
          'Zoning deviation approvals',
          'Excise license denials in certain areas',
        ],
        sources: [
          'Model Building Bye-laws (MBBL) India',
          'National Building Code (NBC) 2016',
          'Local Municipal Corporation Acts & Rules',
          'Environmental Protection Act 1986',
          'Fire Service Act & Rules (State-specific)',
          'Food Safety & Standards Act 2006',
          'Excise Acts (State-specific)',
          'Gazette notification on approval procedures',
        ],
      };

      return {
        content: [{ type: 'text', text: JSON.stringify(checklist, null, 2) }],
      };
    },
  );
}
