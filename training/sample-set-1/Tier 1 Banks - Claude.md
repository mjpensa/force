# ISDA CDM Implementation Roadmap for Tier 1 U.S. Banks

## Executive summary: One bank leads, regulatory complexity drives adoption, smart contracts remain aspirational

**JPMorgan Chase stands alone** among major U.S. banks in operationalizing ISDA CDM and Digital Regulatory Reporting (DRR), announcing production deployment in October 2024 as its primary reporting mechanism across multiple jurisdictions. Despite no explicit regulatory mandate for CDM/DRR adoption, the convergence of CFTC Part 45 rewrite requirements (effective December 2022), EMIR Refit's 203 reporting fields (April 2024), and CPMI-IOSCO harmonization standards creates compelling business case for standardized solutions. The remaining Tier 1 U.S. banks—Bank of America, Citigroup, Goldman Sachs, Morgan Stanley, and Wells Fargo—have not publicly disclosed CDM/DRR implementations despite active derivatives operations, suggesting either non-implementation, early evaluation, or competitive non-disclosure. The four-phase maturity journey from FpML (universally adopted since 2001) → CDM (launched 2018) → DRR (operationalized 2022-2024) → smart contracts (experimental) represents a 25-year evolution, with smart contracts remaining largely aspirational except for Goldman Sachs's DAML-based digital asset platform launched January 2023.

The regulatory landscape reveals that **while no regulator explicitly mandates CDM or DRR**, the practical requirements for multi-jurisdictional reporting create strong adoption drivers. CFTC Part 45 compliance deadlines (December 2022), EMIR Refit effective dates (EU: April 29, 2024; UK: September 30, 2024), and parallel requirements across Singapore (October 2024), Australia (October 2024), Japan (April 2024), and Canada (July 2025) force banks to implement harmonized UTI/UPI/CDE standards—all incorporated within CDM. ISDA's DRR framework now supports 12 reporting regimes across 9 jurisdictions, delivering 100% acknowledgment rates under MAS rules and up to 50% cost reductions according to November 2025 industry analysis. JPMorgan's first-mover advantage positions the bank as industry benchmark, while others face mounting regulatory pressures and implementation costs that could accelerate adoption decisions through 2025-2026.

## Standards definitions and governance

| Standard | Full Name | Governing Body | Current Version | Launch Date | Primary Purpose | Official Source |
|----------|-----------|----------------|-----------------|-------------|-----------------|-----------------|
| **FpML** | Financial products Markup Language | ISDA (FpML Standards Committee) | 5.13 (Recommendation) | June 1999 (JPMorgan/PwC); ISDA integration Nov 2001 | XML standard for electronic derivatives dealing and processing | fpml.org |
| **ISDA CDM** | Common Domain Model | ISDA/ICMA/ISLA via FINOS | Version 6.0 (2025) | June 5, 2018 (v1.0) | Machine-readable/executable model for derivatives lifecycle | isda.org/cdm; cdm.finos.org |
| **DRR** | Digital Regulatory Reporting | ISDA (DRR Working Groups) | Extended to 9+ jurisdictions | November 22, 2022 (v1.0) | Machine-executable code for regulatory reporting rules | isda.org/drr |
| **Smart Contracts** | Smart Derivatives Contracts | ISDA/Tokenovate/FINOS | Taskforce launched Oct 2025 | October 2018 (whitepaper) | Automated derivatives execution with embedded CDM logic | isda.org |

### Detailed definitions

**FpML** establishes the electronic protocol for sharing information on swaps, derivatives and structured products based on XML meta-language. Originally published by JPMorgan and PricewaterhouseCoopers on June 9, 1999, governance transferred to ISDA on November 14, 2001. FpML 5.12 (September 2021) incorporated 2021 ISDA Definitions including RFR fallback rates. The standard covers interest rate, FX, credit, equity, commodity derivatives plus commercial loans, bonds, and repo transactions. FpML enabled the B2B electronic execution, central clearing, and trade reporting infrastructure mandated after the 2009 G-20 summit.

**ISDA CDM** provides a standardized, machine-readable and machine-executable blueprint representing financial products, trades, and lifecycle events. Launched June 5, 2018 by ISDA with technology partner REGnosys, CDM transitioned to FINOS (Fintech Open Source Foundation) governance in February 2023 under Community Specification License 1.0. Written in Rune DSL, CDM generates code in Java, Python, DAML, Scala, C#, Go, TypeScript, Kotlin, and JSON Schema. Version 2.0 (March 2019) opened access to entire market; version 5.0 (November 2023) extended exchange-traded and commodity derivatives; version 6.0 (2025) delivered 100+ functional enhancements including asset refactoring and standardized initial margin schedules. CDM incorporates five core components: product model, event model, process model, reference data model, and legal agreement model.

**DRR** transforms industry-agreed interpretations of regulatory reporting rules into unambiguous, machine-executable code using CDM as foundational data standard. ISDA launched DRR 1.0 on November 22, 2022 ahead of CFTC rule changes (December 5, 2022). The three-step process translates firm transaction data into CDM objects, enriches with reference data, then projects CDM report objects into required formats (ISO 20022 or DTCC Harmonized XML). BNP Paribas successfully tested DRR with CFTC rules on November 2, 2022. As of November 2025, ISDA committed to supporting 12 reporting regimes across 9 jurisdictions: U.S. (CFTC), EU (EMIR/MiFIR), UK (UK EMIR/UK MiFIR), Japan, Singapore, Australia, Canada, Hong Kong, and Switzerland. JSCC (Japan Securities Clearing Corporation) became the first CCP to adopt DRR in January 2025.

**Smart Derivatives Contracts** are derivatives with automatically performable terms expressed in forms enabling efficient automation, while non-automated terms remain in natural language. ISDA's October 2018 whitepaper "Smart Derivatives Contracts: From Concept to Construction" established a five-step framework: select automation-appropriate terms, formalize legal terms, break into component functions, combine into templates, and validate legal equivalence. On October 21, 2025, ISDA and Tokenovate launched a taskforce under FINOS to develop open-source, production-ready smart contract libraries embedding CDM functions and workflows. Initial focus targets automation of interest rate resets using 2021 ISDA Interest Rate Derivatives Definitions—processes underpinning $548 trillion notional value of outstanding contracts (end-2024). Smart contracts use CDM functions as building blocks, with embedded logic creating deterministic, auditable execution promoting interoperability with digital infrastructure, tokenization, and AI-driven solutions.

### Technical relationships across the four phases

The evolutionary architecture shows **FpML (2001)** establishing XML messaging standards, followed by **ISDA CDM (2018)** extending beyond messaging to encompass full lifecycle with machine-executable logic and FpML mapping capabilities (CDM 7-dev branch includes FpML ingest functions). **DRR (2022)** leverages CDM as its foundational data model for the translate-enrich-project workflow converting regulatory rules into executable code. **Smart Contracts (2018-2025)** utilize CDM functions and event models as building blocks, with the new ISDA/Tokenovate taskforce developing smart contract frameworks directly within CDM. All four standards maintain ISDA governance or influence, ensuring ecosystem consistency. The progression demonstrates increasing automation: from data exchange (FpML) → standardized model (CDM) → regulatory compliance (DRR) → automated execution (Smart Contracts).

## U.S. regulatory mandates and drivers

### CFTC Part 45 & 46 Rewrite fundamentally reshaped reporting requirements

The CFTC finalized sweeping changes to swap data reporting on November 25, 2020 (Federal Register 85 FR 75503), with effective date January 25, 2021 and compliance deadline extended to **December 5, 2022**. This "CFTC Rewrite" harmonizes swap data elements with CPMI-IOSCO international technical guidance, implementing Unique Transaction Identifier (UTI), Unique Product Identifier (UPI), and 100+ Critical Data Elements (CDEs). The rules apply to all swap data repositories (SDRs), swap execution facilities (SEFs), designated contract markets (DCMs), swap dealers (SDs), major swap participants (MSPs), and reporting counterparties. Requirements eliminate duplicate reporting, extend deadlines to T+1 for SD/MSP/DCOs and T+2 for others, and mandate daily valuation, margin, and collateral reporting for SDs/MSPs/DCOs.

**Connection to CDM/DRR**: ISDA launched DRR 1.0 on November 22, 2022—two weeks before the December 5, 2022 CFTC compliance deadline—specifically to address these requirements. JPMorgan Chase became the first major U.S. bank implementing DRR/CDM as primary reporting mechanism for CFTC rules. While **not mandated**, DRR provides mutualized interpretation of CFTC Part 45 in machine-executable code, significantly reducing implementation burden.

A subsequent CFTC proposal (RIN 3038-AF26, December 28, 2023, Federal Register 88 FR 90412) would add 49 new data elements and extend UPI to "Other Commodity" asset class, with expected compliance Q2/Q3 2025 pending finalization. Separately, CFTC Order 8659-23 (February 16, 2023) mandated UPI usage for Credit, Equity, FX, and Interest Rate swaps effective **January 29, 2024**, designating Derivatives Service Bureau (DSB) as UPI service provider.

### SEC Regulation SBSR covers security-based swaps

The SEC adopted Regulation SBSR (17 CFR 242.900-909) in February 2015 (Federal Register 80 FR 14564, March 19, 2015), with first compliance date **November 8, 2021** for security-based swap dealers (SBSDs) and major security-based swap participants (MSBSPs). Requirements mandate 24-hour (T+1) reporting of all security-based swap transactions to registered SDRs with Legal Entity Identifier (LEI) mandatory. The SEC's cross-border requirements (Exchange Act Release No. 87780, December 18, 2019) became effective March 1, 2020, with a 2019 Compliance Statement providing 4-year enforcement flexibility that **expired November 8, 2025**—full cross-border enforcement now active.

**Connection to CDM/DRR**: While CDM can support SBS reporting, ISDA has not prioritized DRR development for SEC rules given the separate regulatory regime and smaller market scope relative to CFTC swaps.

### Prudential regulators provide supervisory guidance without technology mandates

The OCC, Federal Reserve, and other prudential regulators have not issued explicit CDM/DRR mandates but emphasize data quality and operational resilience. Key issuances include OCC Bulletin 2024-20 on Third-Party Arrangements (July 2024), Interagency Guidance on Third-Party Relationships (June 2023), and SR 11-7 on Model Risk Management (April 2011). The OCC's Quarterly Report on Bank Trading and Derivatives Activities tracks derivatives exposures but does not prescribe reporting technologies. Basel III capital and liquidity requirements for derivatives drive risk management systems but don't mandate specific standards.

**Supervisory approach**: Technology modernization encouraged through examination processes focusing on data quality, operational risk, and third-party dependencies, but implementation decisions remain bank-specific.

## Cross-border requirements driving multi-jurisdictional compliance

### EMIR Refit dramatically expanded EU reporting requirements

EU Regulations 2022/1855, 2022/1856, 2022/1858, and 2022/1860 (Official Journal, October 7, 2022) overhauled European derivatives reporting, with EU effective date **April 29, 2024** and UK effective date **September 30, 2024**. Reportable fields increased from 129 to **203**, ISO 20022 XML format became mandatory, and UPI/UTI requirements aligned with CPMI-IOSCO standards. Collateral and valuation reporting requirements expanded, with mandatory delegated reporting for financial counterparties (FCs) trading with non-financial counterparties minus (NFC-). EU remediation deadline was October 26, 2024; UK remediation deadline extends to March 31, 2025.

**Impact on U.S. banks**: All U.S. GSIBs with EU branches/subsidiaries must comply. JPMorgan, Bank of America, Citigroup, Goldman Sachs, Morgan Stanley, and Wells Fargo operate EU entities subject to full EMIR requirements. Extraterritorial application affects U.S. swap dealers trading with EU counterparties.

**Connection to CDM/DRR**: ISDA DRR supports EMIR Refit for both EU (April 29, 2024) and UK (September 30, 2024), with JPMorgan and BNP Paribas confirmed as production users. The November 2025 ISDA/Capgemini report documented 98.2% acknowledgment rates for EMIR Refit reporting using DRR. ESMA and national competent authorities actively monitor compliance with full enforcement in effect.

### APAC jurisdictions implemented synchronized reporting overhauls

**Singapore** (MAS Rewrite): Securities and Futures (Reporting of Derivatives Contracts) (Amendment) Regulations 2024 (S 410/2024) became effective **October 21, 2024**, requiring ISO 20022 XML format, UTI/UPI generation aligned with CPMI-IOSCO, and T+2 reporting timelines. Re-reporting deadline for existing contracts with >6 months remaining maturity: April 21, 2025. Applies to specified financial institutions, capital markets license (CMSL) holders, and entities with derivatives aggregating >SGD 8 billion. ISDA DRR supports MAS Rewrite (October 21, 2024) with documented 100% acknowledgment rates.

**Australia** (ASIC Rewrite): ASIC Derivative Transaction Rules (Reporting) 2024 Phase 1 effective **October 21, 2024**, with Phase 2 changes October 20, 2025. Requirements include ISO 20022 XML format, UTI/UPI standards, lifecycle reporting for all product types, and "nexus derivative" test for foreign entities (October 2025). Measured compliance period extends until March 1, 2025, after which full enforcement activates. ISDA DRR supports ASIC Rewrite (October 21, 2024).

**Japan**: JFSA rewrite effective **April 1, 2024**. JSCC (Japan Securities Clearing Corporation) became first CCP globally to adopt DRR in production (January 2025).

**Canada**: Effective **July 25, 2025**. ISDA DRR support confirmed.

**Hong Kong**: Effective **September 29, 2025**. ISDA DRR development in process.

## CPMI-IOSCO harmonization creates global data standards

The Committee on Payments and Market Infrastructures (CPMI) and International Organization of Securities Commissions (IOSCO) published technical guidance establishing global harmonization: UTI Technical Guidance (February 2017), UPI Technical Guidance (September 2017), CDE Technical Guidance (April 2018 defining 100+ Critical Data Elements), and Governance Arrangements (October 2019 designating Regulatory Oversight Committee as International Governance Body). Implementation recommendation targeted Q3 2022.

**Connection to CDM**: ISDA CDM incorporates all CPMI-IOSCO harmonized data elements (UTI, UPI, CDEs), providing standardized representation of these requirements. While no regulator explicitly mandates CDM adoption, meeting CPMI-IOSCO harmonization requirements through CDM reduces implementation complexity across multiple jurisdictions. The Financial Stability Board (FSB) designated DSB as UPI service provider (May 2019) and established UTI governance (December 2017) to enable global derivatives data aggregation for systemic risk monitoring.

## Tier 1 U.S. bank implementation status

### JPMorgan Chase: Production leader with multi-jurisdiction deployment

**FpML Status**: Operationalized since industry adoption era. JPMorgan co-created FpML standard with PricewaterhouseCoopers, first publishing it June 9, 1999. Following ISDA integration November 2001, FpML became foundational infrastructure for trade confirmation, regulatory reporting, and post-trade processing across all derivative asset classes.

**CDM Status**: **✓ PRODUCTION OPERATIONALIZED**  
**Go-Live Date**: Operational by October 30, 2024 announcement  
**Scope**: Primary reporting mechanism across multiple jurisdictions with ongoing rollout  
**Evidence**: Official JPMorgan Chase technology blog announcement (October 30, 2024): "As part of our commitment to leveraging open source technologies securely and compliantly, we're proud to be the first major U.S. bank to implement CDM/DRR as a primary reporting mechanism." Nick Moger from JPMorgan named first sell-side CDM maintainer in FINOS community (2024). JPMorgan won FINOS "Adoption Achiever" award at 2024 Open-Source Finance Forum in New York.  
**Source**: jpmorganchase.com/about/technology/blog/jpmc-launches-finos-open-source-solution; finos.org; isda.org

**DRR Status**: **✓ PRODUCTION OPERATIONALIZED**  
**Go-Live Date**: Operational by October 2024  
**Jurisdictions**: CFTC (United States), EMIR (European Union), JFSA (Japan), with additional jurisdictions planned  
**Technology Stack**: FINOS CDM version 5+, Rune DSL for machine-executable code, outputs ISO 20022 format and DTCC Harmonized XML, JSON and Python distributions  
**Benefits Cited**: "Transformative efficiencies for both technology and operations," simplification of regulatory reporting landscape, foundation for future CDM business use cases  
**Public Knowledge Sharing**: JPMorgan presented detailed implementation breakdown in ISDA webinar  
**Source**: JPMorgan technology blog; isda.org/drr; tradeheader.com (lists "JPMorgan" as firms using CDM and DRR in production)

**Smart Contracts Status**: Pilot/Research Phase  
**Known Activity**: Member of R3 consortium developing Corda blockchain; contributed to ISDA/Digital Asset CDM smart contract reference implementations using DAML; collateral management platform (JPMorgan CommanD) for derivatives not smart contract-based; member of FINOS community working on CDM/DRR providing foundation for future smart contracts  
**Production Use**: No production smart contracts for derivatives confirmed  
**Strategic Position**: CDM/DRR implementation creates technical foundation for eventual smart contract deployment

### Bank of America: Unknown status despite active derivatives business

**FpML Status**: Operationalized (assumed, industry standard). Bank of America active in derivatives markets as ISDA member; specific implementation dates not publicly disclosed.

**CDM Status**: **UNKNOWN - No public announcements found**  
**Search Results**: No press releases, case studies, or regulatory filings found regarding CDM implementation. Not listed in ISDA case studies or DRR adopter lists.  
**Industry Position**: Won multiple Risk.net awards for derivatives trading (2022, 2024) including "Equity derivatives house of the year" and "Interest rate derivatives house of the year," indicating sophisticated derivatives operations but no CDM mentions.  
**Possible Status**: May be evaluating, planning, or quietly implementing without public disclosure.

**DRR Status**: **UNKNOWN - No public information found**  
**Evidence**: Evidence of derivatives technology investments (Glass/Norad volatility monitoring, proprietary platforms) but no DRR mentions in investor relations, press releases, ISDA case studies, Risk.net coverage, or SEC EDGAR 10-K filings.

**Smart Contracts Status**: **UNKNOWN - No public information found**  
**Blockchain Activity**: Bank of America filed numerous blockchain patents but specific derivatives smart contract implementations not disclosed.

**Information Gap Note**: Bank of America clearly invests in derivatives technology and won industry awards, but specific CDM/DRR status remains undisclosed. Could indicate: (1) not yet implemented, (2) evaluating, (3) implemented but not publicized, or (4) using alternative proprietary solutions.

### Citigroup: Regulatory pressure drives massive modernization, CDM status undisclosed

**FpML Status**: Operationalized (assumed, industry standard). Citigroup operates as major derivatives dealer and ISDA member; R3 consortium member working on Corda blockchain. Specific dates not publicly disclosed.

**CDM Status**: **UNKNOWN - No public announcements found**  
**Search Results**: No press releases or case studies found. Not listed in ISDA case studies or public DRR adopter lists.  
**Context**: Massive technology transformation underway but no specific CDM mentions.

**DRR Status**: **UNKNOWN - No public implementation announcements**  
**Regulatory Context**: Citigroup received $135.6 million in regulatory fines (July 2024) from Federal Reserve and OCC for data quality management failures related to regulatory reporting. CEO Jane Fraser acknowledged "decades of underinvestment" in data infrastructure. 2024 Federal Reserve feedback identified "shortcoming in Citigroup's 2023 resolution plan regarding Citi's derivatives unwind capabilities."  
**Current Initiatives**: Launched "regulatory reporting platform" in 2024 (specific technology not disclosed); deployed "AI-assisted data management tool"; consolidated four activity risk management platforms to one; spending $12.2B (2023) and $11.8B (2024) on modernization.  
**Key Quote**: "We have fallen short in data quality management, particularly related to regulatory reporting" - CFO Mark Mason, Q2 2024 earnings call  
**Implication**: Citi rebuilding regulatory reporting infrastructure but specific solution (CDM/DRR vs. proprietary) not disclosed.  
**Source**: ciodive.com/news/citi-data-modernization; bankingdive.com; Federal Reserve Board 2024 consent order

**Smart Contracts Status**: **UNKNOWN - No production implementations found**  
**Blockchain Activity**: R3 consortium member (Corda blockchain); active OTC derivatives platform but no smart contract derivatives implementations publicly disclosed.

**Technology Modernization Context**: $2.9B transformation spending in 2024, $3B+ in 2023; retired 1,250+ applications since 2022; under consent orders requiring data and reporting improvements; must submit targeted resolution plan by July 1, 2025 addressing derivatives unwind capabilities. Despite massive spending on regulatory reporting infrastructure, no public evidence of CDM/DRR adoption found. May be pursuing proprietary solutions or CDM/DRR implementation not yet mature enough to announce publicly.

### Goldman Sachs: Technology contributor but not confirmed production user

**FpML Status**: Operationalized (industry standard). FpML adoption predates 2010s as standard practice for all major dealers. Used for derivatives trade confirmation, reporting, and post-trade processing.

**CDM Status**: **Active Development/Testing Phase**  
**Key Involvement**: 2020 - Co-leads FINOS Financial Objects Special Interest Group (FO SIG) with ISDA; open sourced Legend data modeling platform to FINOS and conducted successful pilot for CDM model changes using Legend. 2025 - FINOS materials state "DTCC, Goldman Sachs and others are now actively supporting further development and are testing or deploying the framework."  
**Role**: Technology contributor and CDM ecosystem developer rather than announced production user  
**Scope**: CDM development through Legend platform integration  
**Source**: finos.org press releases; ISDA materials on CDM Active Project status

**DRR Status**: **Testing/Pilot Phase (No Production Announcement)**  
**Timeline**: Testing phase as of 2025  
**Evidence**: Mentioned alongside DTCC as supporting DRR development and deployment, but no specific go-live date or production implementation announced  
**Source**: FINOS CDM materials (2025)

**Smart Contracts Status**: **✓ PRODUCTION (DAML-based platform)**  
**Announcement**: January 2023 - Goldman Sachs Digital Asset Platform (GS DAP™) went live  
**Technology**: Built on DAML (Digital Asset Modeling Language)  
**Description**: "End-to-end digital asset platform...faster matching of buyers and sellers, quicker settlements, increased liquidity, stronger risk management, and expanded investor access to digital assets"  
**Partnership**: Digital Asset (creator of DAML)  
**Historical Context**: 2019 - ISDA and Digital Asset announced CDM reference model in DAML; ISDA-Digital Asset collaboration on CDM Event Specification Module  
**Source**: halborn.com/blog/post/daml-and-canton-an-introduction

**Note**: Goldman's technology contribution role (Legend platform, FO SIG leadership) should not be conflated with internal CDM/DRR production adoption for regulatory reporting. The bank leads CDM development but has not announced production DRR implementation.

### Morgan Stanley: Unknown status across all phases

**FpML Status**: Operationalized (industry standard). As major swap dealer and OTC derivatives market leader registered with CFTC as Swap Dealer and conditionally registered with SEC as Security-Based Swap Dealer, standard ISDA documentation implies FpML adoption. Q1 2024 OCC data shows $37.0 trillion in total derivatives (4th largest among U.S. holding companies), used across equity, fixed income, FX, and commodity derivatives.

**CDM Status**: **UNKNOWN - No Public Disclosure**  
**Note**: No public announcements, case studies, or regulatory filings found mentioning CDM implementation. Leading provider of equity derivatives execution globally with extensive OTC derivatives business. As ISDA member and major derivatives dealer, likely monitoring CDM developments but no confirmed implementation.

**DRR Status**: **UNKNOWN - No Public Disclosure**  
**Note**: No evidence found of DRR adoption or pilot programs.

**Smart Contracts Status**: **UNKNOWN - No Public Disclosure**  
**Note**: No evidence found of derivatives smart contract implementations. January 2025 partnership with Wise Platform for cross-border FX settlements (not smart contracts).

### Wells Fargo: Unknown status with smaller derivatives footprint

**FpML Status**: Operationalized (industry standard). Registered swap dealer (WFBNA) offering interest rate, FX, and commodity derivatives under CEA. WFBNA registered as swap dealer with CFTC and security-based swap dealer (SBSD) with SEC. Standard ISDA documentation and derivatives processing infrastructure assumed.

**CDM Status**: **UNKNOWN - No Public Disclosure**  
**Note**: No public announcements or regulatory filings found mentioning CDM implementation. Active in derivatives markets but smaller OTC derivatives footprint than Goldman Sachs or Morgan Stanley.

**DRR Status**: **UNKNOWN - No Public Disclosure**  
**Note**: No evidence found of DRR adoption or pilot programs.

**Smart Contracts Status**: **UNKNOWN - No Public Disclosure**  
**Recent Technology**: January 27, 2025 - Partnership with Derivative Path for FX Payment APIs integration providing "real-time FX rates across more than 120 currency pairs." This represents API integration for FX payments, not smart contracts for derivatives.  
**Source**: businesswire.com/news/home/20250127141116

## Bank implementation matrix: JPMorgan leads, others silent

| Bank | FpML Status | FpML Date | CDM Status | CDM Date | DRR Status | DRR Date | Smart Contracts | Evidence Quality |
|------|-------------|-----------|------------|----------|------------|----------|-----------------|------------------|
| **JPMorgan Chase** | ✓ Operationalized | Co-creator 1999; ISDA 2001 | ✓ **PRODUCTION** | Operational Oct 2024 | ✓ **PRODUCTION** | Operational Oct 2024 | Pilot/Research | **HIGH** - Official announcement, awards |
| **Bank of America** | ✓ Operationalized | Not disclosed | Unknown | N/A | Unknown | N/A | Unknown | **LOW** - No public disclosure |
| **Citigroup** | ✓ Operationalized | Not disclosed | Unknown | N/A | Unknown | N/A | Unknown | **LOW** - No public disclosure |
| **Goldman Sachs** | ✓ Operationalized | Not disclosed | Testing/Pilot | Testing 2025 | Testing/Pilot | Testing 2025 | ✓ **GS DAP™ Production** (Jan 2023) | **MEDIUM** - Tech contributor confirmed |
| **Morgan Stanley** | ✓ Operationalized | Not disclosed | Unknown | N/A | Unknown | N/A | Unknown | **LOW** - No public disclosure |
| **Wells Fargo** | ✓ Operationalized | Not disclosed | Unknown | N/A | Unknown | N/A | Unknown | **LOW** - No public disclosure |

**Status Legend:**
- ✓ Operationalized: Confirmed production use
- Testing/Pilot: Active testing or pilot programs
- Unknown: No public information available despite thorough research
- N/A: Not applicable due to unknown status

**Other Confirmed Implementations** (for context):
- **BNP Paribas**: DRR production (November 2022 first test; ongoing production use)
- **Pictet Group**: DRR production
- **Standard Chartered**: Contributing to DRR development
- **JSCC (Japan)**: First CCP to adopt DRR (January 2025)

## Implementation drivers beyond regulation

### Business case drivers accelerating voluntary adoption

**Cost reduction**: November 2025 ISDA/Capgemini analysis documents up to 50% reduction in ongoing regulatory reporting costs through DRR. Mutualized development eliminates need for each bank to independently interpret complex regulations. One industry participant noted implementation challenges center on "mapping from internal data to CDM" rather than regulatory interpretation.

**Data quality improvements**: DRR delivers 100% acknowledgment rates under MAS rules and 98.2% for EMIR Refit, dramatically reducing regulatory penalties for incorrect/misreported data. Standardized interpretation eliminates reconciliation breaks in dual-sided reporting regimes.

**Multi-jurisdictional efficiency**: Single DRR implementation supports 12 reporting regimes across 9 jurisdictions, with centralized updates as rules evolve. Banks operating globally (all Tier 1 U.S. banks) face multiplicative compliance burden—CFTC + EMIR + MAS + ASIC + others—creating strong efficiency case.

**Regulatory pressure without mandates**: While no regulator explicitly requires CDM/DRR, increased data element requirements (203 fields under EMIR vs. 129 previously), ISO 20022 format mandates, and enhanced data quality scrutiny create practical necessity. Citigroup's $135.6M regulatory fines for data quality failures illustrate enforcement risk.

**Market infrastructure requirements**: DTCC and clearinghouses increasingly support CDM-based reporting. JSCC's January 2025 DRR adoption signals market infrastructure shift that could create network effects driving bank adoption.

**Competitive positioning**: JPMorgan's October 2024 announcement and industry recognition positions the bank as technology leader. First-mover advantages in operational efficiency and regulatory relationships may pressure competitors to follow.

**Technology modernization cycles**: Banks retiring legacy derivatives platforms face build-vs-buy decisions where CDM provides industry-standard alternative to proprietary development. Citigroup retiring 1,250+ applications since 2022 represents potential CDM adoption opportunity.

### Why banks don't disclose: Competitive dynamics and strategic timing

**Competitive sensitivity**: Technology infrastructure represents strategic advantage; banks rarely announce middleware/infrastructure implementations until materially complete and advantageous to publicize.

**Implementation complexity**: Multi-year journeys involving data mapping, system integration, testing, and rollout may not warrant announcement until production-proven across multiple jurisdictions.

**Regulatory focus**: 10-K filings emphasize risk factors and material changes, not operational technology details unless financially material or required disclosure.

**Alternative approaches**: Banks may pursue proprietary solutions, vendor implementations, or hybrid approaches that don't clearly fall under "CDM/DRR adoption" terminology.

**Early-stage evaluation**: Banks may be piloting or evaluating CDM/DRR without commitment to production, making public disclosure premature.

## Timeline of regulatory deadlines and industry milestones

### Historical milestones driving the maturity journey

**1999-2001: FpML Foundation**
- June 9, 1999: JPMorgan and PricewaterhouseCoopers publish first FpML standard
- November 14, 2001: ISDA integrates FpML governance
- Industry-wide adoption accelerates through 2000s as electronic trading grows

**2017-2018: International Harmonization**
- February 2017: CPMI-IOSCO publishes UTI Technical Guidance
- September 2017: CPMI-IOSCO publishes UPI Technical Guidance
- April 2018: CPMI-IOSCO publishes CDE Technical Guidance (100+ Critical Data Elements)
- **June 5, 2018: ISDA launches CDM 1.0** covering interest rate and credit derivatives
- October 2018: ISDA publishes "Smart Derivatives Contracts: From Concept to Construction" whitepaper

**2019: CDM Opens to Market**
- **March 20, 2019: CDM 2.0 released**, opening access to entire market, expanding to equity swaps and ISDA CSA for initial margin
- April 2019: ISDA and Digital Asset announce CDM reference model in DAML for smart contracts

**2020-2021: CFTC Rewrite**
- November 25, 2020: CFTC finalizes Part 45 & 46 Rewrite (Federal Register 85 FR 75503)
- January 25, 2021: CFTC Part 45 Rewrite effective date
- November 8, 2021: SEC Regulation SBSR first compliance date

**2022: DRR Launch and CFTC Compliance**
- May 25, 2022: Original CFTC Part 45 compliance date (later extended)
- November 2, 2022: BNP Paribas successfully tests DRR with CFTC rules
- **November 22, 2022: ISDA launches DRR 1.0**, opens access to entire market
- **December 5, 2022: CFTC Part 45 Rewrite compliance deadline** (final extended date)

**2023: CDM Governance Transition**
- January 2023: Goldman Sachs GS DAP™ (DAML-based digital asset platform) goes live
- February 16, 2023: CFTC mandates UPI usage (Order 8659-23)
- **February 2023: CDM governance transitions to FINOS** (Fintech Open Source Foundation)
- November 2023: CDM 5.0 released with extended coverage of exchange-traded derivatives, commodity derivatives, enhanced collateral management

**2024: Multi-Jurisdictional Implementation Wave**
- January 29, 2024: CFTC UPI compliance date for Credit, Equity, FX, Interest Rate swaps
- April 1, 2024: Japan (JFSA) rewrite effective date
- **April 29, 2024: EU EMIR Refit effective date** (203 reporting fields, ISO 20022 mandatory)
- **September 30, 2024: UK EMIR Refit effective date**
- October 21, 2024: Singapore (MAS) and Australia (ASIC) rewrites effective date
- October 26, 2024: EU EMIR remediation deadline
- **October 30, 2024: JPMorgan Chase announces CDM/DRR production implementation** as primary reporting mechanism, wins FINOS "Adoption Achiever" award

**2025: Expansion and Smart Contract Development**
- January 2025: JSCC (Japan Securities Clearing Corporation) adopts DRR—first CCP globally
- March 1, 2025: Australia ASIC measured compliance period ends (full enforcement)
- March 31, 2025: UK EMIR remediation deadline
- June 2025: CDM 6.0 released with 100+ functional/technical enhancements
- July 25, 2025: Canada rewrite effective date
- September 29, 2025: Hong Kong (HKMA) rewrite effective date
- **October 21, 2025: ISDA and Tokenovate launch taskforce** to develop smart contract framework within CDM, initial focus on interest rate resets
- October 20, 2025: Australia ASIC Phase 2 changes (nexus derivative test, alternative reporting removal)
- November 8, 2025: SEC cross-border compliance statement expires (full enforcement active)
- **November 10, 2025**: ISDA/Capgemini report documents DRR delivering 100% ACK rates (MAS), 98.2% (EMIR), up to 50% cost reduction

### Regulatory compliance timeline by jurisdiction

| Jurisdiction | Regulation | Effective Date | Compliance/Remediation Date | Status (Nov 2025) |
|--------------|-----------|----------------|----------------------------|-------------------|
| **United States** | CFTC Part 45 Rewrite | Jan 25, 2021 | Dec 5, 2022 | ✓ Fully enforced |
| **United States** | CFTC UPI Mandate | Feb 16, 2023 | Jan 29, 2024 | ✓ Fully enforced |
| **United States** | SEC Regulation SBSR | Feb 2015 | Nov 8, 2021 | ✓ Fully enforced |
| **United States** | SEC Cross-Border | Mar 1, 2020 | Nov 8, 2025 | ✓ Full enforcement active |
| **Japan** | JFSA Rewrite | Apr 1, 2024 | Apr 1, 2024 | ✓ Active |
| **European Union** | EMIR Refit | Apr 29, 2024 | Oct 26, 2024 (remediation) | ✓ Fully enforced |
| **United Kingdom** | UK EMIR Refit | Sep 30, 2024 | Mar 31, 2025 (remediation) | Active, remediation pending |
| **Singapore** | MAS Rewrite | Oct 21, 2024 | Apr 21, 2025 (re-reporting) | Active, re-reporting pending |
| **Australia** | ASIC Rewrite Phase 1 | Oct 21, 2024 | Mar 1, 2025 (measured compliance ends) | Active, full enforcement Mar 1 |
| **Australia** | ASIC Phase 2 | Oct 20, 2025 | Oct 20, 2025 | Upcoming |
| **Canada** | Canadian Rewrite | Jul 25, 2025 | Jul 25, 2025 | Upcoming |
| **Hong Kong** | HKMA Rewrite | Sep 29, 2025 | Sep 29, 2025 | Upcoming |
| **Switzerland** | Swiss Rules | Committed | TBD | Future |

## Gaps and unknowns requiring further investigation

### Bank-specific implementation status: Significant information asymmetry

**For Bank of America, Citigroup, Morgan Stanley, and Wells Fargo**, no public disclosures exist regarding CDM/DRR implementation status despite comprehensive research across:
- Official bank press releases and investor relations materials
- SEC EDGAR 10-K and 10-Q filings (searched for "ISDA", "CDM", "Common Domain Model", "Digital Regulatory Reporting")
- ISDA case studies and member announcements
- DTCC and clearinghouse public announcements
- Financial press coverage (Risk.net, Bloomberg, Reuters, Waters Technology)

**Possible explanations**:
1. Not yet implemented (most likely for Wells Fargo given smaller derivatives footprint)
2. Early evaluation or pilot phase not mature enough to announce
3. Implemented but not publicized for competitive reasons
4. Using alternative proprietary or vendor solutions not captured by "CDM" terminology
5. Technology implementation not considered material disclosure requiring announcement

### Goldman Sachs ambiguity: Contributor vs. user distinction

Goldman Sachs confirmed as **technology contributor** through Legend platform and FINOS leadership, with FINOS materials stating Goldman "testing or deploying the framework" as of 2025. However, **no production DRR announcement equivalent to JPMorgan's October 2024 disclosure**. Unclear whether:
- Internal testing represents path to production deployment
- Technology contribution satisfies internal needs without separate DRR production implementation
- Production implementation exists but remains undisclosed
- Bank pursuing alternative approach leveraging Legend differently than DRR

### Smart contracts for traditional derivatives: Production gap

While Goldman Sachs GS DAP™ represents production smart contract deployment (January 2023), this **focuses on digital assets rather than traditional OTC derivatives**. No Tier 1 U.S. bank has announced production smart contracts for traditional interest rate swaps, credit derivatives, FX derivatives, or equity derivatives. ISDA/Tokenovate taskforce launched October 2025 targeting interest rate reset automation, but timeline to production implementation unknown. Industry remains in pilot phase despite theoretical frameworks dating to 2018 ISDA whitepaper.

### FpML implementation specifics: Historical documentation gap

All banks confirmed using FpML as industry standard since ISDA integration (November 2001), but **specific go-live dates, internal system names, and implementation scope not publicly documented**. This reflects FpML's status as foundational infrastructure predating modern technology disclosure practices. Specific questions remain:
- Which internal systems use FpML at each bank?
- Complete vs. partial product coverage?
- FpML version adoption timeline (5.10, 5.11, 5.12, 5.13)?
- Transition plans from FpML to CDM for existing systems?

### Citigroup regulatory reporting solution: Technology stack unknown

Despite $12.2B (2023) and $11.8B (2024) technology spending, massive regulatory reporting transformation, and public acknowledgment of data quality failures leading to $135.6M fines, **Citigroup has not disclosed whether its new "regulatory reporting platform" (launched 2024) incorporates CDM/DRR**. This represents significant information gap given:
- Clear regulatory driver and urgency
- Consent order requirements for derivatives unwind capability improvements
- July 1, 2025 targeted resolution plan deadline
- Explicit CFO acknowledgment of reporting shortcomings

Unclear whether Citi pursuing proprietary solution, vendor implementation, CDM/DRR adoption, or hybrid approach.

### Market infrastructure CDM requirements: Voluntary vs. mandated

Research identified **JSCC (Japan) as first CCP to adopt DRR** (January 2025), but status of CDM requirements or support at other critical infrastructure providers remains unclear:
- DTCC (U.S. SDR and clearinghouse): CDM support status?
- CME Group: CDM requirements for clearing members?
- ICE Clear: CDM adoption or integration?
- LCH Clearnet: CDM implementation timeline?
- Other U.S. SDRs: CDM support or requirements?

If market infrastructure mandates or strongly encourages CDM adoption, this would create powerful indirect driver for bank implementation beyond regulatory reporting.

### DRR cost-benefit quantification: Bank-specific data unavailable

ISDA/Capgemini November 2025 report provides industry-level metrics (50% cost reduction, 100% ACK rates, 98.2% EMIR ACK rates), but **bank-specific quantification unavailable**:
- JPMorgan's actual cost savings or efficiency gains from DRR implementation
- Implementation costs and timeline for JPMorgan's deployment
- FTE reductions or reallocation from reporting to higher-value activities
- Specific reconciliation break reductions in dual-sided reporting

Without bank-specific data, business case remains theoretical for banks evaluating DRR adoption.

### Regulatory endorsement vs. mandates: Policy evolution unclear

No regulator explicitly mandates CDM/DRR, but **regulatory posture toward industry standards unclear**:
- Do CFTC, SEC, ESMA, MAS, ASIC prefer standardized vs. proprietary implementations?
- Has any regulator provided positive or negative feedback on CDM/DRR?
- Would regulators consider mandating CDM if adoption remains limited?
- Do supervisory examination processes favor standardized approaches?
- Are there regulatory concerns about concentration risk if single standard dominates?

Understanding regulatory perspectives would clarify future adoption drivers.

### Cross-bank coordination: Competitive vs. collaborative dynamics

JPMorgan's first-mover announcement creates **unclear competitive dynamics**:
- Will other banks publicly announce implementations to demonstrate technology leadership?
- Do competitive concerns inhibit public disclosure or information sharing?
- Are banks collaborating through ISDA working groups while maintaining public silence?
- Does JPMorgan's leadership create pressure for competitors to adopt or develop alternatives?

Industry adoption patterns depend significantly on whether banks view CDM/DRR as competitive differentiator or operational utility.

## Conclusion: Early industry transformation with concentrated leadership

The ISDA CDM implementation journey for Tier 1 U.S. banks reveals **a 25-year derivatives technology evolution with single-bank production leadership** as of November 2025. JPMorgan Chase definitively leads as the only major U.S. bank operationalizing CDM/DRR in production (October 2024), leveraging the FpML foundation (co-created 1999) to implement next-generation regulatory reporting across CFTC, EMIR, JFSA, and additional jurisdictions. The remaining Tier 1 banks—Bank of America, Citigroup, Goldman Sachs, Morgan Stanley, and Wells Fargo—maintain operational FpML infrastructure but have not publicly disclosed CDM/DRR implementations, creating significant information asymmetry about industry adoption velocity.

**Regulatory drivers operate indirectly rather than through explicit mandates**. While no regulator requires CDM adoption, the convergence of CFTC Part 45 compliance (December 2022), EMIR Refit's 203 reporting fields (April-September 2024), and CPMI-IOSCO harmonization standards embedded within CDM creates compelling business case. The multi-jurisdictional compliance burden facing all GSIBs—simultaneously meeting CFTC, EMIR, MAS, ASIC, JFSA, and forthcoming Canadian and Hong Kong requirements—drives adoption economics documented in November 2025 ISDA/Capgemini analysis showing 50% cost reductions and near-perfect acknowledgment rates.

**Smart contracts remain aspirational for traditional derivatives** despite theoretical frameworks dating to 2018 ISDA whitepaper. Goldman Sachs's GS DAP™ (January 2023) represents most advanced U.S. bank production deployment but focuses on digital assets rather than traditional swaps. The ISDA/Tokenovate taskforce launched October 2025 targeting $548 trillion notional interest rate contract automation signals renewed momentum, yet production timeline for smart derivatives contracts at Tier 1 banks remains uncertain and likely multi-year.

The maturity journey from FpML (universally adopted 2001) → CDM (launched 2018) → DRR (operationalized 2022-2024) → smart contracts (experimental) demonstrates **progressive automation with widening adoption gaps at each phase**. As transformation accelerates through 2025-2026 with additional jurisdictional effective dates and mounting regulatory pressures, JPMorgan's first-mover advantage may catalyze broader industry adoption or entrench competitive differentiation through operational excellence. For GSIBs facing consent orders (Citigroup), multi-trillion dollar derivatives books (all), and intensifying data quality scrutiny, the strategic question shifts from whether technology modernization is required to which implementation approach delivers optimal risk-adjusted efficiency.