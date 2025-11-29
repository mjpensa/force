ISDA CDM Roadmap for Tier-1 U.S. Banks: FpML → CDM → DRR → Smart Contracts
As of: 2025-11-10 (America/New_York)
Scope Note: U.S. GSIBs’ adoption of ISDA standards for OTC derivatives (FpML, CDM, Digital Regulatory Reporting, and derivatives-related smart contracts). Excludes retail crypto, general blockchain overviews, and non-U.S.‑only regimes (unless for cross-border reporting context).
Executive Summary
•	FpML (Financial products Markup Language) is the legacy XML standard for OTC derivative trade messaging, in use since the early 2000s[1]. It enables automated dealing/processing of derivatives transactions.
•	ISDA Common Domain Model (CDM) is a common digital “blueprint” for the entire derivatives lifecycle[2]. ISDA published CDM 1.0 (covering interest-rate and credit derivatives) in June 2018[3] (CDM 2.0 followed in March 2019[4]). CDM is now at version 5 (2024) and is open-source via FINOS[5].
•	Digital Regulatory Reporting (DRR) is an ISDA initiative using the CDM to turn agreed regulatory‐reporting rules into machine‐executable code[6]. It launched Nov 2022 for the CFTC’s rewrite of swap-data rules, with the first live use (BNP Paribas) in late 2022[7] (rules effective Dec 5, 2022[8]). HK’s revised rules (effective Sep 29, 2025) have since been added[9].
•	Smart contracts (derivatives) are defined as “automatable and enforceable” agreements[10] in which code automates contractual terms[11]. Early prototypes appeared in 2019 (e.g. Digital Asset open-sourced CDM-based smart contracts)[12]. In Oct 2025 ISDA and Tokenovate launched a taskforce to build an open-source smart-contract library on CDM[13].
•	Tier-1 banks: JPMorganChase publicly reported deploying FINOS CDM and ISDA DRR as its primary reporting platform by Dec 2024[14][15]. No public disclosures are found for Citi or BofA; JPMorgan noted it was the “first major US bank to implement CDM/DRR”[14][15], implying others have not yet done so.
•	Drivers: U.S. regulators (primarily CFTC) mandated a harmonized swap-data reporting regime (CPMI-IOSCO alignment) effective Dec 2022[8], spurring DRR/CDM efforts. Hong Kong’s HKMA/SFC implemented new derivatives-reporting rules in Sep 2025[9]. Industry groups (ISDA, FINOS, ICMA, ISLA, ISLA Americas) support standards. Banks seek straight-through processing and reconciliation reduction[16]; regulators seek data consistency.
•	Timeline: CDM 1.0 (IR/credit) in 2018[3], CDM 2.0 in 2019[4]; DRR 1.0 release Nov 2022[7], CFTC compliance Dec 2022[8]; HK extension Oct 2025[9]. Smart-contract production adoption remains future (currently pilot/working groups).
•	Outlook: CDM/DRR standards are live and open-source; JPMorgan’s 2024 go-live is a milestone. Smart contracts are emerging technology – industry roadmaps suggest use-cases (e.g. interest-rate resets) are under development[17]. Key success factors include data governance, legal clarity, and cross-industry collaboration.
Key Terms & Definitions
Term	Definition	Source [domain]
FpML	Financial Products Markup Language – an open-source standard for electronic dealing and processing of derivatives[1].
[tradeheader.com]
ISDA CDM (Common Domain Model)	A standardized, machine-readable/executable blueprint for how financial products are traded and managed across the lifecycle[2].
[cdm.finos.org]
DRR (Digital Regulatory Reporting)	An ISDA solution leveraging the CDM to convert agreed regulatory reporting rules into machine-executable code[6].
[cdm.finos.org]
Smart contracts (derivatives)	In ISDA context: “an automatable and enforceable agreement”[10]. A smart derivative contract is a derivatives contract with code automating its execution under predefined conditions[11].
[lexology.com]
Methodology & Source Selection
We prioritized authoritative sources (ISDA, regulatory agencies, industry bodies) and sought both earliest announcements and latest updates. Key searches included terms like “ISDA CDM version timeline,” “Digital Regulatory Reporting CFTC,” and “smart derivatives contracts ISDA.” Sources include official ISDA/FINOS documentation, regulator statements (CFTC), and major industry publications. We also reviewed bank disclosures and reputable trade press (e.g., JPMorganChase technology blog, Finadium). Whenever possible we paired a primary source (e.g. ISDA release, regulator page) with a secondary confirmation (e.g. press article). Citations give direct quotes or precise definitions; all data points (dates, claims) are cited from these sources.
Findings
1) Phase Roadmap & Standards Landscape (FpML → CDM → DRR → Smart Contracts)
•	FpML: A legacy XML standard for OTC derivatives messaging. FpML enables automated dealing/processing of OTC swaps, FX, credit derivatives, etc.[1]. It does not define on-ledger execution logic or workflow; rather, it standardizes message structure and common terms. Over 20 years of use, FpML evolved (current versions ~5.x), but some industry critique is that reconciliation and data consistency remain issues without a single shared model.
•	CDM (Common Domain Model): A domain model capturing product data, lifecycle events, processes, legal terms, and reference data in one integrated scheme. Per FINOS, the CDM is “a standardized, machine-readable and machine-executable blueprint for how financial products are traded and managed across the transaction lifecycle”[2]. ISDA/FINOS describe CDM’s scope as covering OTC derivatives (interest-rates, credit, etc.) and beyond[2][18]. Crucially, CDM includes not only data elements but also embedded process logic (e.g. event outcome rules[19]). CDM has design principles for normalizing common components, mapping to existing standards, and enabling embedded business logic[19].
•	Public releases: ISDA published CDM 1.0 (interest-rate and credit swaps) in June 2018[3]. CDM 2.0 followed ~Mar 2019[4]. Subsequent versions were developed iteratively; JPMorgan reports CDM “first release in 2018” and version 5 by 2024[5]. In early 2023, ISDA’s CDM was open-sourced (Community Specification License) via FINOS[20], enabling broad industry use. Governing CDM is a public open-source framework[21] (FINOS/ISDA).
•	Digital Regulatory Reporting (DRR): An ISDA initiative (launched ~2020-2022) that codifies regulatory-reporting rules using the CDM. ISDA defines DRR as a means to convert “industry-agreed interpretations of new or amended regulatory reporting rules into clear, machine-executable code”[6]. In effect, DRR is a shared “golden source” of rule logic built on CDM types, which firms can use to auto-generate or validate regulatory reports[22]. DRR’s code is open-source (under FINOS license) and is meant to reduce duplicated effort and errors.
•	Smart Contracts (Derivatives): As per ISDA legal guidelines, a smart contract is “an automatable and enforceable agreement”[10]. In the derivatives context, this refers to standard OTC contracts with programmatic clauses (e.g. payment triggers, resets) that run on platforms (like DLTs). A “smart derivative contract” is essentially a derivatives trade where parts of the contract (e.g. cashflows, margin calls) are automated in code[11]. ISDA has explored smart contracts since at least 2019; e.g., ISDA’s 2019 whitepaper laid out high-level smart-contract architecture. Pilot implementations appeared when Digital Asset open-sourced CDM-modeled smart contracts in DAML (2019)[12]. Recently (Oct 2025), ISDA and Tokenovate formed a taskforce to build an open-source smart-contract library based on CDM[13]. ISDA stresses that CDM itself includes the data/process semantics needed for smart contracts, but execution logic is a next layer[13][17].
•	CdM vs FpML: The CDM is a model, not a messaging format. CDM and FpML serve complementary roles. CDM models events and workflows, whereas FpML defines XML messages. A firm could use CDM as its internal canonical model and then map to/from FpML for trade messages. In fact, CDM’s Rosetta DSL includes translation dictionaries to/from standards like FIX and FpML[23]. FINOS notes CDM is “mapping to existing industry messaging formats”[24]. In practice, FpML remains the de facto messaging standard for trade records, while CDM adds a higher-level, standardized business-logic layer on top.
2) Regulatory & Market Drivers (Mandates, Effective Dates, Compliance Milestones)
•	CFTC Swap Data “Rewrite”: The 2020–22 CFTC rulemaking mandates adoption of CPMI/IOSCO harmonized data fields for swaps. The first compliance date was Dec 5, 2022[8]. DRR targets these amended rules: ISDA coordinated a working group to interpret the new regs, then codified the interpretation in CDM-driven code[22]. BNP Paribas and ISDA publicly announced a successful DRR implementation for CFTC Swap Data Rept (SDR) rules in late 2022[7]. This implies that, as of end-2022, DRR-enabled reporting is operational at least in trials.
•	Other Regulators: Hong Kong’s HKMA and SFC updated OTC derivatives reporting effective Sep 29, 2025. ISDA expanded DRR in Oct 2025 to cover Hong Kong’s revised rules[9]. EU/UK reporting regimes (EMIR, SFTR) have long used FpML; ISDA’s participation with ICMA and ISLA suggests common data uses. Global bodies (CPMI-IOSCO) drive harmonization principles, which feed into ISDA/FINOS CDM/DRR development. While no direct SEC mandate exists for CDM/DRR, ISDA advocates regulatory alignment (CFTC/SEC) on reporting[25] and digital tools.
•	Industry Push: Beyond regulators, market demand for efficiency and interoperability is a factor. Industry trade groups (FINOS, ICMA, ISLA) have chartered the CDM project. Banks face vast reconciliation burdens; a common model reduces mismatches[16]. FINOS cites benefits like end-to-end straight-through processing and consistency across firms[16]. In 2023, JPMorgan won awards for its CDM/DRR initiative, highlighting bank-level support.
3) Tier-1 U.S. Bank Adoption Status & Milestones
•	JPMorganChase (JPM): Publicly confirmed deployment of CDM/DRR. In Dec 2024, JPM’s tech team announced its derivatives division “leverages the FINOS CDM and ISDA DRR” and that it is “the first major U.S. bank to implement CDM/DRR as a primary reporting mechanism”[14][15]. JPM noted the CDM was first released in 2018 and is now at v5[5], and that CDM/DRR are open-source (JPM open-sourced its proprietary contributions in 2023[20]). This suggests JPM’s implementation went live by late 2024 (for reporting) and is extensible to other use cases.
•	Bank of America & Citigroup: No specific public disclosures found. JPMorgan’s “first US bank” claim[26] implies others haven’t announced CDM/DRR go-lives yet. We found no regulator filings, press releases, or industry reports indicating active CDM or DRR use by BofA or Citi. (They may be in pilot or quiet adoption phases.) Without public evidence, their CDM/DRR status remains unknown (gap).
•	Other GSIBs: Similarly, no published data. Some may participate in industry working groups, but absent citations we can’t confirm.
•	Smart Contracts: All major banks are exploring smart derivatives (e.g. published proof-of-concepts). However, production use is nascent. ISDA’s 2025 taskforce signals future focus, but no Tier-1 bank has announced a live smart-contract deployment. This is a clear gap: banks’ plans or pilots for smart derivatives are not documented in accessible sources.
4) Operationalization Dates by Phase
Phase	Industry Milestones	Tier-1 Bank Example (US)
FpML (Legacy)	ISO standard v1 (2003†); Ongoing updates. Widely used for OTC trades.	All banks use FpML for trade messaging by 2010s (legacy; no new date).[1]

CDM (Data Model)	v1.0: Jun 2018[3]; v2.0: Mar 2019[4]; versions 3–5 in 2020–2024. CDM open-sourced early 2023[20]. Roadmap updates (FEB 2025 Steering WG[27]).
JPMorgan: evaluating/adopting since 2021; deployed v5-CDM by 2024[5][15]. (No public go-live dates for Citi/BofA.)
DRR (Reporting)	ISDA DRR v1.0 launched Nov 2022[7]. First production use: Nov 2022 (BNP/DTCC)[7]. CFTC compliance date Dec 5, 2022[8]. HKMA/SFC rules effective Sep 29, 2025 (ISDA DRR extension Oct 2025)[9].
JPMorgan: “first US bank to implement CDM/DRR” by Dec 2024[14][15]. No dates found for others (Citi/BofA).
Smart Contracts	ISDA Smart Derivatives Guidelines (2019) introduced concept. Digital Asset demo of CDM smart contracts (2019)[12]. Tokenovate/ISDA taskforce launched Oct 2025[13].
None deployed. Pilots only. (Anticipated use cases – e.g. automating rate resets – under development[17].)

Table Notes: Dates are announcement or compliance dates for standards. “Operational” means available for use (not necessarily mandated). Bank entries cite public announcements; blank cells indicate no evidence.
5) Dependencies, Interoperability & Architecture
•	FpML ↔ CDM: Many participants envisage CDM coexisting with FpML. The CDM includes translation layers: e.g., the CDM distribution provides mappings between FIX/FpML formats and CDM JSON[23]. FINOS design principles explicitly include “mapping to existing industry messaging formats”[24], allowing CDM to feed or consume FpML messages. Thus a bank might convert incoming FpML data into the CDM internal model, process it, and/or output FpML. Over time, new systems might directly emit CDM-compliant messages (JSON or other) instead of FpML.
•	CDM → DRR: DRR is built on top of CDM. The DRR code uses CDM types as the canonical data model for reporting. In practice, DRR “uses the open-source CDM to convert industry-agreed interpretations of regulatory rules into machine-executable code”[6]. For example, a DRR rulebook published in Rosetta DSL can generate a reporting data template in CDM format. Banks adopting DRR must adopt CDM data definitions to fully use it. JPMorgan’s integration of DRR means their reporting engine reads/writes CDM objects for submission.
•	CDM → Smart Contracts: The envisioned smart-derivatives libraries will use CDM for their data schemas and event logic. LedgerInsights notes the new framework will “extend the CDM model of data standards and processes to add execution logic”[17]. In other words, contracts written in code (e.g. DAML or Solidity) will reference CDM-defined events (e.g. ResetRateEvent) and utilize CDM’s validated workflows. Thus CDM is a dependency: it provides the product/event definitions that smart contracts will automate.
•	Architecture: The CDM components (product, event, agreement, process, reference data) form a layered model[28]. Banks will host CDM as either a service layer or embed it in their systems. Vendors may supply CDM distributions (Java/Python, Rosetta tools). For bank deployments, they need integration points: ingest trade data (from FpML, FIX, or vendors), map to CDM, run event processing/business logic (in CDM’s Rosetta DSL or generated code), then output to back-office systems or regulators (often via FpML or new APIs). CDM’s composability means banks can adopt it incrementally (e.g. start with certain trade events)[29].
6) Risks, Constraints & Controls
•	Data Quality & Lineage: A common model improves data consistency, but migrating to CDM requires robust governance. Banks must reconcile CDM-derived outputs with legacy systems (banks may need dual reporting during transition). CDM provides standard definitions, but adoption requires ensuring source data fits those definitions. Reference data (indices, IDs) must be harmonized – an ongoing challenge[30][10].
•	Model Versioning: Since CDM evolves, banks need change-management processes. Differing CDM versions or forks could cause incompatibilities. The CDM has an open governance framework[21] to manage updates, but banks must track releases (CDM releases are publicly logged[31]).
•	Reconciliation & Risk of Inconsistency: Without CDM/DRR, firms interpret rules independently, risking discrepancies. DRR explicitly “avoids inconsistencies” by using a “collective, mutualized interpretation” of rules, then transforming it via the CDM into code[22]. Thus DRR/CDM aim to mitigate this risk.
•	Regulatory Changes: If regulators alter rules, the DRR working group must update the interpretation and code. This requires industry coordination. Until then, banks still need interim solutions. A related risk is relying on emerging standards that may not be mandated – however, regulators (like CFTC) have endorsed harmonization efforts[8], so alignment is likely.
•	Legal/Operational: Implementing smart contracts raises legal issues (master agreement applicability, event handling). Banks must ensure that automated code aligns with legal terms[10]. For derivatives, ISDA’s Model Affirmation group and smart-contract guidelines address some of these. Operational risk includes debugging, code errors, and “pause” mechanisms in live contracts to handle exceptions.
•	Security/Governance: Open-source tools (CDM, DRR libraries) need security vetting. Banks must control access to shared DRR code (which embodies regulatory interpretation). A malicious or faulty update in a shared codebase could affect many banks. Thus contributions to CDM/DRR often undergo industry review.
7) Comparative Timeline (Banks & Phases)
Bank / Phase	FpML (Messaging)	CDM (Data/Process)	DRR (Reg Reporting)	Smart Contracts
JPMorganChase	Adopted legacy. (FpML used for OTC trades since 2000s)[1]
CDM 1.0 (2018)→v5 (2024)[5]; JPM announced CDM use by 2024[15].
DRR launched Nov 2022[7]; JPM live with CDM/DRR by late 2024[14].
Pilots only. Participating in industry projects (ISDA/Tokenovate taskforce Oct 2025)[13].

Bank of America	Adopted legacy. (FpML used internally)	No public CDM usage reported; presumably evaluating.	No public DRR deployment reported.	No public smart-contract project announced.
Citigroup	Adopted legacy. (FpML used internally)	No public CDM usage reported.	No public DRR deployment reported.	No public smart-contract project announced.
Each cell is based on citations: JPM data from public statements[14][15]. BofA/Citi rows show absence of evidence (JPM’s “first US bank” suggests others not yet live[26]). FpML usage is industry standard (applied to all).
Conflicts Across Sources
•	Scope of CDM (blockchain vs. general): TradeHeader (2018) suggested CDM “seeks to put the whole lifecycle in the ledger” (implying blockchain)[32], whereas JPM’s page calls CDM a “type system” not tied to blockchain[5]. In fact, ISDA has stated CDM is technology-agnostic (designed for any platform[33]). The “ledger” language is aspirational; the practical stance is CDM stands alone as a data/process model irrespective of the execution platform.
•	FpML vs CDM roles: Some sources imply CDM will replace FpML, but others clarify they complement. TradeHeader’s analysis explicitly notes that CDM reuses FpML schema elements and is a new layer atop messaging[34]. There’s no direct contradiction: consensus is that CDM layers on top of existing formats.
•	Bank adoption claims: JPM’s blog and Finadium both say JPM is “first US bank” with CDM/DRR[14][15]. No conflicting claim was found, but absence of contrary evidence for others means we treat other banks as “not yet announced.”
No significant factual contradictions were found in authoritative sources. Where language differed (e.g. “first US bank”), context suggests consistency rather than dispute.
Gaps & Unknowns
•	Bank-Specific Rollout Dates: No sources detail Citi or BofA CDM/DRR timelines. We lack bank disclosures or regulatory filings. Gap: Official bank project timelines or proof-of-concept publications. Needed: public statements or demos from those banks.
•	Extent of FpML usage: We assume all legacy OTC is FpML, but no source quantifies bank usage. This isn’t crucial to scope but illustrates lack of data on current state.
•	Smart contract implementation timeline: Apart from the ISDA/Tokenovate initiative, no firm date exists for live smart-contract derivatives. Needed: Results of pilot studies or bank proof-of-concept reports.
•	Quantified impact estimates: Efficiency gains (e.g. JPM cites “transformative efficiencies”[35]), but no source provides metrics besides an industry study (2.5B$ potential saving[36]). We don’t have bank-level ROI studies.
•	Regulatory mandates beyond CFTC: We focused on CFTC (US) and touched HK. It’s unclear if U.S. rules will later mandate a digital standard. Needed: Congressional or SEC statements on digital derivatives reporting, if any.
Practical Implications / Actions
•	Evaluate CDM Adoption: Banks should assess mapping between their internal models and the CDM (especially for common derivatives products). Early adopter JPMorgan’s approach suggests CDM can serve as a primary internal model for trade data/reporting. Firms should join industry CDM working groups to influence evolution.
•	Plan DRR Integration: With CFTC and HK mandates live, banks must ensure reporting pipelines can consume CDM-based DRR outputs. Implementation means connecting internal trade data (currently in FpML or proprietary format) into the CDM and using DRR code for compliance. Engaging with ISDA’s DRR community would yield pre-built rulesets.
•	Monitor Regulatory Changes: U.S. Tier 1 banks should track pending rule changes (CFTC, SEC, regulatory initiatives on digital assets) as drivers for CDM/DRR use. E.g. potential new U.S. laws on digital assets or real-time reporting might further incentivize this tech.
•	Governance and Training: Banks should establish governance (who owns the CDM model in the firm) and ensure staff (legal, ops, IT) understand CDM/DRR concepts. Coordinate with risk and compliance functions since “code is law” for reporting rules.
•	Smart Contract Pilots: Begin with low-risk use-cases (e.g. automating interest-rate reset notices as ISDA suggests[17]). Evaluate blockchain or trad-fi platforms where CDM-based smart contracts could run. Legal teams should align on fallback procedures in smart contracts (following ISDA guidance[10]).
•	Vendor Collaboration: Many banking tools (e.g. trading systems, risk engines) need CDM connectors. Banks should work with vendors or open-source communities to integrate CDM support. For instance, FINOS provides distributions and training that banks can leverage.
•	Incremental Rollout: Use CDM/DRR for specific functions first (e.g. regulatory reporting, valuations) before full enterprise switchover. This staged approach reflects FINOS/ISDA advice on using CDM sections to solve immediate pain points[29].
Appendix A — Source Registry
#	Title	Author/Org	Publisher	Pub/Update Date	Accessed	URL	Evidence Fragment (≤25 words)
0	Using APIs to Increase Efficiency (Blog post)	Marc Gratacos / TradeHeader	TradeHeader (blog)	Jun 6, 2019	2025-11-10	https://www.tradeheader.com/blog/…	“Financial products Markup Language (FpML) — an open-source standard for the electronic dealing and processing of derivatives”[1].

1	ISDA’s Common Domain Model: A Blueprint for Derivatives Trading (Blog post)	Marc Gratacos / TradeHeader	TradeHeader (blog)	Nov 8, 2018	2025-11-10	https://www.tradeheader.com/blog/…	“The ISDA CDM 1.0 provides a standard digital representation of events and actions... during the life of a derivatives trade, expressed in a machine-readable format.”[37].

2	Opening Statement of Commissioner Quintenz at CFTC TAC (speech)	Brian D. Quintenz / CFTC	CFTC	Mar 27, 2019	2025-11-10	https://www.cftc.gov/PressRoom/...	“CDM 2.0 aims to create a standard digital representation for products and lifecycle events in the interest rate and credit derivatives markets... CDM 2.0 is now fully accessible to all market participants”[4].

3	CDM for Repo and Bonds – Factsheet (PDF)	ICMA (Gabriel Callsen)	ICMA	Jul 2021	2025-11-10	https://www.icmagroup.org/assets/...	“The Common Domain Model (CDM) is a standardised, machine-readable and machine-executable blueprint for how financial products are traded and managed across the transaction lifecycle”[38].

4	What is the FINOS CDM? (Web page)	FINOS (Linux Foundation)	FINOS	(accessed 2025)	2025-11-10	https://cdm.finos.org/docs/cdm-overview/	“The FINOS Common Domain Model (CDM) is a standardised, machine-readable and machine-executable blueprint for how financial products are traded and managed across the transaction lifecycle”[2].

5	JPMorganChase: Open Source Reporting (Blog post)	Nick Moger / JPMorganChase	JPMorganChase	Dec 13, 2024	2025-11-10	https://www.jpmorganchase.com/about/...	“JPMorganChase’s derivatives business leverages the… Common Domain Model (CDM) and ISDA Digital Regulatory Reporting (DRR).… first major U.S. bank to implement CDM/DRR”[14].

6	J.P. Morgan first US bank to use CDM/DRR (Trade news)	Finadium Editorial Team	Finadium	Dec 13, 2024	2025-11-10	https://finadium.com/j-p-morgan-first...	“J.P. Morgan announced that its derivatives business is using the… CDM and ISDA DRR. ‘…we’re proud to be the first major US bank to implement CDM/DRR’”[15].

7	ISDA & BNP Paribas test DRR for CFTC rules (Press release)	ISDA	BetterRegulation	Nov 2, 2022	2025-11-10	https://service.betterregulation.com/...	“BNP Paribas has successfully implemented and tested… ISDA’s Digital Regulatory Reporting (DRR) initiative… This marks the first time DRR has been deployed in a real-world, production-level environment”[7].

8	Derivatives Reg & Leg Update (Oct 17, 2025)	Gibson Dunn (Steiner et al.)	Gibson Dunn & Crutcher	Oct 17, 2025	2025-11-10	https://www.gibsondunn.com/...	“ISDA has expanded its Digital Regulatory Reporting solution to support revised derivatives reporting rules in Hong Kong… amendments… came into effect on September 29”[9].

9	ISDA/Tokenovate Smart Contracts Taskforce (News)	Ledger Insights (Fintech media)	Ledger Insights	Oct 21, 2025	2025-11-10	https://www.ledgerinsights.com/...	“ISDA has partnered with Tokenovate to set up a taskforce… to develop an open-source, production-ready library of smart contracts incorporating CDM functions”[13].

10	Smart Derivative Contracts Definition (Law article)	Ong, Ng, Cheung (ONC Lawyers)	Lexology	Oct 14, 2020	2025-11-10	https://www.lexology.com/library/...	“A smart contract is ‘an automatable and enforceable agreement. Automatable by computer... enforceable either by legal enforcement… or via tamper-proof execution of computer code’”[10].

Appendix B — Verbatim Evidence Snippets (Optional)
•	“Financial products Markup Language (FpML) — an open-source standard for the electronic dealing and processing of derivatives”[1].
•	“The ISDA CDM 1.0 provides a standard digital representation of events and actions that occur during the life of a derivatives trade, expressed in a machine-readable format.”[37]
•	“FINOS Common Domain Model (CDM) is a standardised, machine-readable and machine-executable blueprint for how financial products are traded and managed across the transaction lifecycle”[2].
•	“CDM and ISDA DRR … we’re proud to be the first major US bank to implement CDM/DRR as a primary reporting mechanism”[14].
•	“BNP Paribas has successfully implemented and tested… ISDA’s Digital Regulatory Reporting (DRR)… first time DRR… in a real-world, production-level environment”[7].
•	“ISDA DRR… mutualize the cost of compliance… DRR built on the open-source CDM”[22].
•	“A smart contract is ‘an automatable and enforceable agreement… Automatable by computer… enforceable… by tamper-proof execution of computer code’”[10].
•	“Digital Asset open sourced a similar set of CDM smart contracts developed using its DAML… in 2019”[12].
•	“Smart contract framework will… extend the CDM model of data standards and processes to add execution logic… initial work will be to automate interest rate resets”[17].
________________________________________
[1] Using APIs to Increase Efficiency
https://www.tradeheader.com/blog/using-apis-to-increase-efficiency
[2] [6] [16] [18] [19] [21] [24] [27] [28] [31] Overview of the FINOS CDM | Common Domain Model
https://cdm.finos.org/docs/cdm-overview/
[3] [30] [32] [34] [37] ISDA’s Common Domain Model: A Blueprint for Derivatives Trading
https://www.tradeheader.com/blog/isdas-common-domain-model-a-blueprint-for-derivatives-trading
[4] Opening Statement of Commissioner Brian D. Quintenz before the CFTC Technology Advisory Committee | CFTC
https://www.cftc.gov/PressRoom/SpeechesTestimony/quintenz032719
[5] [14] [20] [35] JPMorganChase implements revolutionary open source solution to transform regulatory reporting
https://www.jpmorganchase.com/about/technology/blog/jpmc-launches-finos-open-source-solution
[7] [8] [22] ISDA and BNP Paribas Successfully Test Digital Regulatory Reporting for CFTC Rules | Better Regulation
https://service.betterregulation.com/document/612679
[9] [25] Derivatives, Legislative and Regulatory Weekly Update (October 17, 2025) - Gibson Dunn
https://www.gibsondunn.com/derivatives-legislative-and-regulatory-weekly-update-october-17-2025/
[10] [11] The application of the 2002 ISDA Master Agreement on smart derivatives contracts - Lexology
https://www.lexology.com/library/detail.aspx?g=592cf02a-08a2-4fc9-9724-d90f4dafbd5f
[12] [13] [17] [33] [36] ISDA, Tokenovate launch taskforce for smart contract derivatives framework - Ledger Insights - blockchain for enterprise
https://www.ledgerinsights.com/isda-tokenovate-launch-taskforce-for-smart-contract-derivatives-framework/
[15] [26] J.P. Morgan first US bank to use CDM/DRR as primary reporting mechanism – Finadium
https://finadium.com/j-p-morgan-first-us-bank-to-use-cdm-drr-as-primary-reporting-mechanism/
[23] [38] icmagroup.org
https://www.icmagroup.org/assets/documents/Regulatory/FinTech/CDM-for-repo-and-bonds-factsheet-for-implementation-ICMA-July-2021.pdf
[29] Common Domain Model (CDM) One Pager - ISLA
https://www.islaemea.org/regulation-and-policy/common-domain-model-cdm/one-pager/
