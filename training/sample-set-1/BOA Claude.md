# Bank of America's Derivatives Data Roadmap: FpML, CDM, DRR, and Smart Contracts
> **As of:** 2025-11-10 (America/New_York)  
> **Scope Note:** This report focuses on the strategic roadmap for derivatives data standards at Tier 1 US banks, with a specific and primary focus on Bank of America (BofA). It compares BofA's progress and anticipated milestones for FpML, ISDA CDM, Digital Regulatory Reporting (DRR), and smart contracts against JPMorgan Chase (JPM). The analysis includes key drivers and timelines for each phase. Information on other banks is out of scope unless used for high-level context.

## Executive Summary
* **JPMorgan Chase leads in public DRR adoption:** JPMorgan became the first major U.S. bank to implement ISDA Digital Regulatory Reporting (DRR) as a primary reporting mechanism in 2024, winning the 'Adoption Achiever' award [jpmorganchase.com].
* **BofA's specific CDM/DRR plans remain non-public:** Despite Bank of America's status as an ISDA member and participant in major ISDA protocols, specific public disclosures regarding BofA's CDM adoption timeline or DRR implementation plans were not identified in authoritative sources [isda.org].
* **CDM now production-ready:** The ISDA Common Domain Model evolved from proof-of-concept to production-grade open standard since its open-sourcing, now hosted by FINOS under Community Specification License 1.0 [finos.org].
* **DRR operational across multiple jurisdictions:** ISDA DRR 1.0 launched in November 2022 for CFTC compliance, with BNP Paribas as first production user; coverage has expanded to 9 jurisdictions including EU, UK, Japan, Australia, Singapore, and Canada [isda.org].
* **Smart contracts framework established:** ISDA has published extensive legal guidelines for smart derivatives contracts across multiple jurisdictions starting in 2020, establishing legal framework for DLT-based derivatives [isda.org].
* **JPMorgan's blockchain advantage:** JPMorgan's Onyx platform (rebranded to Kinexys in 2024) has processed over $1.5 trillion in transactions since 2020, with J.P. Morgan's Nick Moger serving as a CDM maintainer [jpmorgan.com, finos.org].

## Key Terms & Definitions
| Term | Definition | Source [domain] |
| :--- | :--- | :--- |
| FpML | Financial products Markup Language. An XML-based open source standard for electronic dealing and processing of OTC derivatives. Established as industry protocol for sharing information on derivatives and structured products. | [fpml.org] |
| ISDA CDM | International Swaps and Derivatives Association Common Domain Model. A standardized, machine-readable and machine-executable model that represents financial products, trades in those products and the lifecycle events of those trades. Now hosted by FINOS. | [isda.org] |
| DRR | Digital Regulatory Reporting. An ISDA solution that uses the open-source CDM to transform an industry-agreed interpretation of new or amended regulatory reporting rules into unambiguous, machine-executable code. | [isda.org] |
| Smart Contracts | Self-executing contracts with terms of agreement directly written into code. In derivatives context, used to describe multi-party workflows and automate transactions between participants on distributed ledger technology. | [isda.org] |
| FINOS | Fintech Open Source Foundation. Now hosts the CDM under Community Specification open governance process with code assets released under Community Specification License 1.0. | [finos.org] |

## Methodology & Source Selection
Research employed web-based searches prioritizing authoritative sources per the Authority Ladder: (1) ISDA and regulatory bodies, (2) bank primary sources (BofA, JPMorgan official sites), (3) trade associations, and (4) tier-one financial journalism (Risk.net, Reuters, Bloomberg). Keywords included: "ISDA Common Domain Model," "Bank of America CDM," "JPMorgan DRR implementation," "Digital Regulatory Reporting timeline," "FpML CDM transition," and "smart contracts derivatives ISDA." All cited sources accessed between 2025-11-10.

## Findings

### The Four-Phase Data Standards Roadmap: FpML to Smart Contracts

The derivatives industry is transitioning through four key technology phases representing an evolution from legacy messaging standards to automated, blockchain-enabled execution:

**Phase 1 - FpML (Legacy Foundation):** FpML was first released in 2001 covering vanilla interest rate swaps and forward rate agreements, establishing an XML-based protocol for sharing derivatives information electronically [fpml.org]. The standard has since expanded to cover interest rates, credit, equity, FX, commodities, securities and loans [isda.org]. FpML served as the foundation but lacked machine-executable capabilities and consistent process representation across firms.

**Phase 2 - ISDA CDM (Standardization Layer):** The ISDA CDM addresses the fragmentation where each firm maintained unique representations of trade events and processes, requiring continual reconciliation [isda.org]. ISDA published CDM 2.0 for deployment in March 2019, providing full representations for interest rate and credit derivatives [isda.org]. The CDM was open-sourced and moved to FINOS in 2022, where it is developed through community specification open governance [finos.org]. The CDM establishes standard representations for how financial products are traded and managed across the transaction lifecycle, enhancing consistency and facilitating interoperability [isda.org].

**Phase 3 - DRR (Regulatory Automation):** DRR leverages the CDM to transform mutualized industry interpretations of regulatory reporting rules into machine-executable code [isda.org]. ISDA launched DRR 1.0 in November 2022 ahead of CFTC swap data reporting rule changes effective December 5, 2022 [isda.org]. The DRR significantly reduces the time, resources and cost needed to implement reporting regulations by providing validated code that firms can implement directly or use for validation [isda.org].

**Phase 4 - Smart Contracts (Execution Layer):** ISDA has been developing legal and technical frameworks for smart derivatives contracts using distributed ledger technology since 2018, collaborating with Digital Asset to create open-source reference code libraries in DAML [isda.org]. Smart contracts enable automation of derivatives contract execution and lifecycle events by describing contracts in terms of rights, obligations and market conditions [isda.org].

The roadmap progression shows: FpML provided messaging format → CDM provides standardized data model → DRR enables automated regulatory reporting → Smart contracts enable automated execution and lifecycle management.

### Key Drivers for Adoption

**FpML (Legacy):** Initial adoption driven by need to automate flow of information across derivatives networks independent of underlying software/hardware infrastructure, responding to rapid OTC derivatives market growth since 1980s [fpml.org]. Post-2008 financial crisis, G-20 Pittsburgh summit mandated electronic trading and central clearing, driving further FpML standardization [fpml.org].

**ISDA CDM:** Key drivers include: (1) eliminating reconciliation costs from firms maintaining unique event representations, (2) enabling automation and straight-through processing by establishing standard representations, (3) reducing operational risk from manual processes, and (4) creating foundation for innovation by allowing providers to focus on specialization rather than individually representing market events [isda.org]. ISLA research indicated 50-70% efficiency increase achievable by restructuring interest rate swap data to use CDM [islaemea.org].

**DRR:** Primary drivers are: (1) regulatory compliance pressure as global regulators revise reporting rules incorporating harmonized data standards, (2) cost reduction by mutualizing interpretation of rules rather than each firm independently building reporting logic, (3) accuracy improvement delivering cleaner data for regulatory aggregation and systemic risk evaluation, and (4) penalty avoidance by reducing risks of regulatory censure for misreported data [isda.org]. Industry participants reported operational cost reductions up to 50% and improved data quality with high trade repository acknowledgement rates [isda.org].

**Smart Contracts:** Drivers include: (1) operational efficiency through increased automation of trade management, (2) reduced counterparty risk via atomic settlement capabilities, (3) cost savings from streamlined processes, (4) interoperability improvements by facilitating standardized multi-party workflows, and (5) faster settlement times enabling T+0 settlement potential [isda.org]. Legal framework development by ISDA across multiple jurisdictions (English, Singaporean, French, Irish, Japanese, New York law) provides regulatory clarity [isda.org].

### Bank of America (BofA): Current State and Operationalization Timeline

**ISDA Membership and Protocol Participation:** Bank of America is confirmed as an ISDA member institution and has adhered to major ISDA protocols including the 2014 Resolution Stay Protocol and the 2015 Universal Resolution Stay Protocol [isda.org]. Bank of America N.A. is listed as a voting dealer on the Credit Derivatives Determinations Committees effective from April 2024 [businesswire.com].

**Digital Transformation Investments:** Bank of America spent $3.8 billion on new technologies in 2023 and planned equivalent spending in 2024, focusing on data infrastructure, AI capabilities, and digital banking platforms [ciodive.com]. The bank has invested billions in digital transformation under its "High-Tech, High Touch" approach, exploring blockchain, big data, artificial intelligence, cloud and biometrics [prnewswire.com].

**Derivatives Technology Initiatives:** Bank of America has made significant investments in equity derivatives technology and structured products platforms, particularly building third-party distribution capabilities for retail structured notes [risk.net]. The bank's global equity derivatives business saw 17% revenue surge in first three quarters of 2024 driven by structured derivatives [risk.net].

**Gaps in Public CDM/DRR Disclosure:** Extensive research across ISDA publications, bank official communications, and industry sources did not identify specific public statements or disclosures regarding: (1) Bank of America's CDM adoption status or implementation timeline, (2) Bank of America's participation in DRR development or deployment plans, or (3) specific operationalization dates for CDM or DRR at Bank of America. This absence of public disclosure does not indicate lack of activity, as many technology implementations proceed without public announcement.

### Comparative Analysis: BofA vs. JPMorgan Chase (JPM) Milestones

| Phase | JPMorgan Chase Status | Bank of America Status | JPM Leadership Gap |
| :--- | :--- | :--- | :--- |
| **FpML (Legacy)** | Extensive legacy use as ISDA member [isda.org] | Extensive legacy use as ISDA member [isda.org] | Comparable |
| **CDM Adoption** | Nick Moger of J.P. Morgan serves as CDM maintainer, representing first sell-side maintainer [finos.org] | No public CDM-specific roles or adoption announcements identified | JPM has visible leadership role |
| **DRR Implementation** | First major U.S. bank to implement CDM/DRR as primary reporting mechanism in 2024; won 'Adoption Achiever' award at FINOS Open-Source Finance Forum [jpmorganchase.com] | No public DRR implementation announcements identified | JPM significantly ahead in public disclosure |
| **DRR Jurisdictional Coverage** | Live with DRR for ASIC (Australia) and MAS (Singapore) regimes; seeing "reduced testing complexity and increased automation capabilities" [finos.org] | No public information available | JPM demonstrably ahead |
| **Blockchain/DLT Platform** | Onyx platform (rebranded Kinexys 2024) launched 2020; processed $1.5 trillion+ since inception, averaging $2B+ daily [jpmorgan.com] | Exploring blockchain technologies as part of digital transformation strategy [prnewswire.com] | JPM significantly ahead with production platform |
| **Smart Contract Activity** | Tokenized Collateral Network operational; executed BlackRock money market fund tokenization for derivatives collateral in 2023 [coindesk.com] | No public smart contract derivatives initiatives identified | JPM ahead in production use cases |

**JPMorgan's DRR Timeline:** JPMorgan implemented DRR using open-source CDM in 2024 for derivatives regulatory reporting [jpmorganchase.com]. The bank's goal was "simplification within the regulatory reporting landscape, which has evolved constantly and rapidly over the last decade" [jpmorganchase.com]. JPMorgan presented detailed breakdown of CDM/DRR implementation journey to prospective implementers at ISDA webinar [isda.org].

**JPMorgan's Blockchain Strategy:** Onyx Digital Assets platform (now Kinexys Digital Assets) launched in 2020, enabling tokenization of traditional assets including U.S. Treasurys and money-market products [jpmorgan.com]. The Tokenized Collateral Network allows clients to tokenize money market fund shares for use as derivatives collateral, with BlackRock completing first transaction transferring tokenized shares to Barclays for OTC derivatives trade in October 2023 [coindesk.com]. The platform was rebranded to Kinexys in November 2024 to reflect evolution toward mainstream tokenization adoption [coindesk.com].

**BNP Paribas as First DRR Adopter:** BNP Paribas successfully implemented and tested DRR in November 2022, marking first deployment in real-world production-level environment with successful data submission to DTCC swap data repository for CFTC amended rules [isda.org]. This established proof of concept for DRR's end-to-end implementation capabilities [isda.org].

**Other Institutions:** Japanese Securities Clearing Corporation (JSCC) announced in January 2025 as first CCP and Japanese entity to announce DRR and CDM adoption within production environment [finos.org]. RBC is taking leadership in advancing DRR with cloud-based implementations [finos.org]. Institutions involved in DRR development include Standard Chartered, Pictet Group, and others [tradeheader.com].

### Industry Timeline for DRR Expansion

**Implemented Jurisdictions (as of 2025):**
- United States (CFTC): December 5, 2022 (DRR 1.0 launch) [isda.org]
- Japan (JFSA): April 1, 2024 [isda.org]
- European Union (EMIR): April 29, 2024 [isda.org]
- United Kingdom (UK EMIR): September 30, 2024 [isda.org]
- Singapore (MAS): October 21, 2024 [isda.org]
- Australia (ASIC): October 21, 2024 [isda.org]
- Canada: July 25, 2025 [isda.org]

**In Development:**
- Hong Kong (HKMA): September 29, 2025 [isda.org]
- EU and UK MiFID/MiFIR: Expected 2027 implementation with ISDA/DTCC collaboration announced May 2025 [disruptionbanking.com]
- Switzerland (FINMA), U.S. SEC, CSA: In scope for 2025 development [tradeheader.com]

The DRR architecture enables significant code reuse: approximately 70% of CFTC coded rules transfer directly to European DRR, and 90% of combined U.S. and European rules applicable to Asia-Pacific [isda.org].

## Conflicts Across Sources

**Bank of America Technology Spending Timeframe:** One source indicates Bank of America "spent $3.8 billion on new technologies last year and plans to do the same this year" referenced to Q4 2023 earnings [ciodive.com], while another source from 2022 states "Bank of America has invested billions of dollars to grow its digital platforms" without specifying annual amounts [thefinancialbrand.com]. These are not contradictory but reflect different reporting periods and levels of specificity.

**No Substantive Conflicts Identified:** Research did not reveal conflicting authoritative statements regarding technical specifications, implementation dates, or strategic directions for the four data standards phases. The primary challenge is absence of information rather than conflicting information, particularly regarding Bank of America's specific plans.

## Gaps & Unknowns

### Bank of America Specific Gaps:
1. **CDM Adoption Timeline:** Specific dates or phases for Bank of America's CDM implementation are not publicly disclosed.
2. **DRR Implementation Status:** Whether Bank of America is developing, testing, or implementing DRR solutions remains undisclosed publicly.
3. **Smart Contract Initiatives:** Any pilots, proofs-of-concept, or production deployments of smart contracts for derivatives at Bank of America are not publicly documented.
4. **Internal Budgets and ROI:** Investment amounts specifically allocated to CDM/DRR/smart contract initiatives are not public.
5. **Technical Architecture:** Specific choices regarding CDM integration points (upstream systems, post-trade layer, reporting stage) are not disclosed.
6. **Implementation Challenges:** Specific obstacles or lessons learned in any CDM-related work are not publicly shared.

### Industry-Wide Gaps:
1. **Precise Operationalization Timelines:** While JPMorgan disclosed 2024 DRR implementation, many institutions' specific go-live dates remain confidential.
2. **Adoption Rates:** Percentage of derivatives volume processed through CDM-based systems at individual institutions is not publicly reported.
3. **Cross-Institution Interoperability:** Real-world testing results for CDM-based straight-through processing between different institutions are not comprehensively documented in public sources.
4. **Smart Contract Production Use:** Beyond JPMorgan's Tokenized Collateral Network, production-scale smart contract deployments for derivatives lifecycle management remain limited in public disclosure.
5. **Cost-Benefit Quantification:** Precise cost savings and ROI metrics from CDM/DRR implementations are generally not disclosed, with exception of qualitative statements about "up to 50%" operational cost reductions [isda.org].

### Technical Evolution Gaps:
1. **FpML to CDM Migration:** Industry-wide timelines and strategies for migrating from FpML-based systems to CDM-based systems are not standardized or publicly documented.
2. **Backwards Compatibility:** How institutions are managing dual-running of legacy FpML and modern CDM systems during transition is not comprehensively documented.
3. **Vendor Ecosystem:** Complete catalog of technology vendors supporting CDM/DRR implementations and their specific offerings is fragmented across sources.

## Appendix A — Source Registry

| # | Title | Author/Org | Publisher | Pub/Update Date | Accessed | URL | Evidence Fragment (≤25 words) |
| :-- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | CDM – International Swaps and Derivatives Association | ISDA | ISDA | 2025 | 2025-11-10 | https://www.isda.org/isda-solutions-infohub/cdm/ | "standardized, machine-readable and machine-executable model that represents financial products, trades" |
| 2 | Common Domain Model (CDM) Resources | FINOS | FINOS | 2025 | 2025-11-10 | https://www.finos.org/common-domain-model | "Nick Moger of J.P. Morgan" as "first sell-side maintainer" |
| 3 | Overview of the FINOS CDM | FINOS | FINOS | 2025 | 2025-11-10 | https://cdm.finos.org/docs/cdm-overview/ | "hosted by FINOS under the Community Specification License 1.0" |
| 4 | ISDA Publishes CDM 2.0 for Deployment | ISDA | ISDA | 2019-03-20 | 2025-11-10 | https://www.isda.org/2019/03/20/isda-publishes-cdm-2-0-for-deployment-and-opens-access-to-entire-market/ | "full version of the ISDA Common Domain Model" "for interest rate and credit derivatives" |
| 5 | What is FpML? | FpML.org | FpML Standards | 2025 | 2025-11-10 | https://www.fpml.org/about/what-is-fpml/ | "Financial products Markup Language" "XML" "electronic dealing and processing of derivatives instruments" |
| 6 | FpML – International Swaps and Derivatives Association | ISDA | ISDA | 2025 | 2025-11-10 | https://www.isda.org/isda-solutions-infohub/fpml/ | "Extensible Markup Language (XML)" "standard text-based meta language for describing data shared between applications" |
| 7 | ISDA Digital Regulatory Reporting | ISDA | ISDA | 2025 | 2025-11-10 | https://www.isda.org/isda-solutions-infohub/isda-digital-regulatory-reporting/ | "uses the open-source Common Domain Model" "machine-executable code" "implementation more efficient" |
| 8 | ISDA Launches Digital Regulatory Reporting 1.0 | ISDA | ISDA | 2022-11-22 | 2025-11-10 | https://www.isda.org/2022/11/22/isda-launches-digital-regulatory-reporting-1-0-and-opens-access-to-entire-market/ | "launched" "November 22, 2022" "CFTC" "December 5" compliance date |
| 9 | ISDA and BNP Paribas Successfully Test DRR | ISDA | ISDA | 2022-11-02 | 2025-11-10 | https://www.isda.org/2022/11/02/isda-and-bnp-paribas-successfully-test-digital-regulatory-reporting-for-cftc-rules/ | "BNP Paribas has successfully implemented and tested" "first time" "production-level environment" |
| 10 | JPMorganChase implements open source solution | JPMorgan Chase | JPMorgan Chase | 2024-12-13 | 2025-11-10 | https://www.jpmorganchase.com/about/technology/blog/jpmc-launches-finos-open-source-solution | "first major U.S. bank to implement CDM/DRR as a primary reporting mechanism" |
| 11 | Introducing Kinexys | JPMorgan Chase | JPMorgan Chase | 2024 | 2025-11-10 | https://www.jpmorgan.com/insights/payments/payment-trends/introducing-kinexys | "exceeded $1.5 trillion in notional value" "more than $2 billion daily" |
| 12 | JPMorgan Renames Blockchain Platform to Kinexys | CoinDesk | CoinDesk | 2024-11-06 | 2025-11-10 | https://www.coindesk.com/business/2024/11/06/jpmorgan-renames-blockchain-platform-to-kynexis-to-add-on-chain-fx-settlement-for-usd-eur | "$1.5 trillion of transactions" "since its inception in 2020" |
| 13 | JPMorgan Debuts Tokenized BlackRock Shares | CoinDesk | CoinDesk | 2023-10-11 | 2025-11-10 | https://www.coindesk.com/business/2023/10/11/jpmorgan-debuts-tokenized-blackrock-shares-as-collateral-with-barclays | "BlackRock to tokenize shares" "transferred to Barclays Plc for collateral in an OTC derivatives trade" |
| 14 | ISDA Smart Contracts | ISDA | ISDA | 2025 | 2025-11-10 | https://www.isda.org/2019/10/16/isda-smart-contracts/ | "legal and regulatory uncertainty" "smart contracts and DLT, to derivatives trading" |
| 15 | ISDA Launches New Legal Papers on Smart Contracts | ISDA | ISDA | 2020-10-21 | 2025-11-10 | https://www.isda.org/2020/10/21/isda-launches-new-legal-papers-on-smart-contracts-and-dlt/ | "legal issues associated with using smart derivatives contracts on distributed ledger technology" |
| 16 | Digital Asset and ISDA Introduce Tool | ISDA | ISDA | 2019-04-09 | 2025-11-10 | https://www.isda.org/2019/04/09/digital-asset-and-isda-introduce-tool-to-help-drive-adoption-of-isda-cdm/ | "open-source reference code library" "DAML" "automate transactions between participants" |
| 17 | Bank of America CEO on digital transformation | CIO Dive | CIO Dive | 2024-01-17 | 2025-11-10 | https://www.ciodive.com/news/bank-of-america-spends-billions-tech-innovation-generative-AI/704748/ | "Bank of America spent $3.8 billion on new technologies last year" |
| 18 | Digital Transformation and Fintech Strategies | PR Newswire | Research and Markets | 2018-10-24 | 2025-11-10 | https://www.prnewswire.com/news-releases/digital-transformation-and-fintech-strategies-of-bank-of-america-300737223.html | "Blockchain, Big Data, Artificial Intelligence, Cloud and Biometrics" |
| 19 | Equity derivatives house of the year: Bank of America | Risk.net | Risk.net | 2025-08-29 | 2025-11-10 | https://www.risk.net/awards/7960358/equity-derivatives-house-of-the-year-bank-of-america | "17% surge in equity revenue" "structured derivatives" |
| 20 | Major Banks Agree to Sign ISDA Resolution Stay Protocol | ISDA | ISDA | 2014-10-11 | 2025-11-10 | https://www.isda.org//2014/10/11/major-banks-agree-to-sign-isda-resolution-stay-protocol | "Bank of America Merrill Lynch" "JP Morgan Chase" listed as adhering firms |
| 21 | Common Domain Model (CDM) – ICMA | ICMA | ICMA | 2025 | 2025-11-10 | https://www.icmagroup.org/market-practice-and-regulatory-policy/repo-and-collateral-markets/fintech/common-domain-model-cdm/ | "ICMA completed phase 2" "February 2023" repo and bonds |
| 22 | Common Domain Model (CDM) – ISLA | ISLA | ISLA | 2025-04-11 | 2025-11-10 | https://www.islaemea.org/common-domain-model/ | "50 to 70% increase in efficiency" by restructuring data for interest rate swaps |
| 23 | Industry Perspectives on the ISDA DRR | ISDA | ISDA | 2025-11-10 | 2025-11-10 | https://www.isda.org/2025/11/10/industry-perspectives-on-the-isda-drr-unlocking-efficiency-accuracy-and-strategic-value | "ongoing costs of up to 50% were highlighted" operational efficiency improvements |
| 24 | Five steps to DRR implementation | REGnosys | REGnosys | 2025 | 2025-11-10 | https://regnosys.com/insights/five-steps-to-drr-implementation/ | "BNP Paribas' successful implementation in 2022" "JP Morgan recently going live in 2024" |
| 25 | Banks Harness Open Source Innovation | FINOS | FINOS | 2024 | 2025-11-10 | https://www.finos.org/blog/banks-harness-open-source-innovation-to-transform-regulatory-reporting | "JP Morgan's adoption of DRR for ASIC and MAS" "reduced testing complexity" |
| 26 | ISDA Extends DRR to New Jurisdictions | ISDA | ISDA | 2024-04-17 | 2025-11-10 | https://www.isda.org/2024/04/17/isda-extends-digital-regulatory-reporting-initiative-to-new-jurisdictions/ | "UK on September 30, 2024, and October 21, 2024 in Australia and Singapore" |
| 27 | ISDA to Extend DRR to cover MIFID/MIFIR | Disruption Banking | Disruption Banking | 2025-05-07 | 2025-11-10 | https://www.disruptionbanking.com/2025/05/07/isda-to-extend-drr-to-cover-mifid-mifir-reporting-and-works-with-dtcc-to-further-adoption/ | "EU and the UK over the course of 2027" "first quarter of 2026" |
| 28 | DRR: Frequently Asked Questions | TradeHeader | TradeHeader | 2025 | 2025-11-10 | https://www.tradeheader.com/blog/drr-frequently-asked-questions | "BNP Paribas, Pictet Group, and JPMorgan are some of the firms using CDM and DRR in production" |
| 29 | Credit Derivatives Determinations Committees | Business Wire | DC Administration Services | 2025-03-13 | 2025-11-10 | https://www.businesswire.com/news/home/20250313137889/en/Credit-Derivatives-Determinations-Committees-Membership-Applications-for-2025 | "Bank of America N.A." listed as "Voting Dealer" effective April 27, 2024 |
| 30 | 9 Digital Banking Stats from Bank of America | The Financial Brand | The Financial Brand | 2022-04-11 | 2025-11-10 | https://thefinancialbrand.com/news/digital-transformation-banking/bank-of-americas-commitment-to-digital-transformation-paying-massive-dividends-137169 | "Bank of America has invested billions of dollars to grow its digital platforms" |

---

**Report Compiled:** 2025-11-10  
**Research Scope:** Authoritative public sources including ISDA, FINOS, bank official publications, and tier-one financial journalism  
**Limitations:** Bank of America's specific CDM/DRR implementation plans are not disclosed in public sources; report relies on publicly available information only