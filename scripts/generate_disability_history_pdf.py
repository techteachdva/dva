#!/usr/bin/env python3
"""
Generate college-level PDF: Society and Disability in the 20th Century
For special education / education major coursework.
"""

from pathlib import Path

from fpdf import FPDF

# Helvetica core font is Latin-1 only; normalize common Unicode punctuation.
_UNICODE_REPLACEMENTS = str.maketrans(
    {
        "\u2013": "-",  # en dash
        "\u2014": "-",  # em dash
        "\u2018": "'",
        "\u2019": "'",
        "\u201c": '"',
        "\u201d": '"',
        "\u2022": "*",
        "\u00a7": "Section ",
        "\u00e9": "e",
        "\u00e8": "e",
        "\u00f1": "n",
    }
)


def t(text: str) -> str:
    return text.translate(_UNICODE_REPLACEMENTS)


class AcademicPDF(FPDF):
    def footer(self):
        self.set_y(-15)
        self.set_font("Helvetica", "I", 9)
        self.set_text_color(80, 80, 80)
        self.cell(0, 10, f"Page {self.page_no()}", align="C")


def section_title(pdf: AcademicPDF, text: str):
    pdf.ln(4)
    pdf.set_font("Helvetica", "B", 13)
    pdf.set_text_color(20, 60, 100)
    pdf.multi_cell(0, 8, t(text))
    pdf.set_text_color(0, 0, 0)
    pdf.ln(2)


def subsection(pdf: AcademicPDF, text: str):
    pdf.set_font("Helvetica", "B", 11)
    pdf.set_text_color(40, 40, 40)
    pdf.multi_cell(0, 7, t(text))
    pdf.set_text_color(0, 0, 0)
    pdf.ln(1)


def body(pdf: AcademicPDF, text: str):
    pdf.set_font("Helvetica", "", 10)
    pdf.multi_cell(0, 5.5, t(text))
    pdf.ln(2)


def bullet(pdf: AcademicPDF, text: str):
    pdf.set_font("Helvetica", "", 10)
    pdf.multi_cell(0, 5.5, t(f"  -  {text}"))
    pdf.ln(1)


def build_pdf(output_path: Path) -> None:
    pdf = AcademicPDF()
    pdf.set_auto_page_break(auto=True, margin=20)
    pdf.set_margins(25, 25, 25)

    # Title page
    pdf.add_page()
    pdf.ln(40)
    pdf.set_font("Helvetica", "B", 22)
    pdf.set_text_color(20, 60, 100)
    pdf.multi_cell(0, 12, t("Society and Disability\nin the 20th Century"), align="C")
    pdf.ln(8)
    pdf.set_font("Helvetica", "", 14)
    pdf.set_text_color(60, 60, 60)
    pdf.multi_cell(
        0,
        8,
        "Historical Foundations for\nSpecial Education Practice",
        align="C",
    )
    pdf.ln(20)
    pdf.set_font("Helvetica", "", 11)
    pdf.set_text_color(0, 0, 0)
    pdf.multi_cell(
        0,
        7,
        "A research brief for education majors\nSpecial Education / Inclusive Education coursework",
        align="C",
    )
    pdf.ln(30)
    pdf.set_font("Helvetica", "I", 10)
    pdf.multi_cell(
        0,
        6,
        t(
            "Compiled for college-level study. Emphasis: United States with\n"
            "select international context. Primary focus: 1900-1999."
        ),
        align="C",
    )

    # Table of contents hint
    pdf.add_page()
    section_title(pdf, "Purpose and How to Use This Brief")
    body(
        pdf,
        "Understanding how society treated people with disabilities in the 20th century "
        "is not merely historical curiosity. It explains why contemporary special education "
        "law, ethics, and practice look the way they do\u2014why inclusion, least restrictive "
        "environment (LRE), person-first and identity-first language debates, and family "
        "partnership are central rather than optional.",
    )
    body(
        pdf,
        "This document synthesizes peer-reviewed scholarship, government and museum "
        "historical resources, and landmark legal cases. Use it to connect past "
        "institutional practices to present Individualized Education Programs (IEPs), "
        "504 plans, and Multi-Tiered Systems of Support (MTSS).",
    )
    subsection(pdf, "Learning Objectives")
    for obj in [
        "Describe major shifts in societal attitudes toward disability across the 20th century.",
        "Explain how eugenics, institutionalization, and the medical model shaped special education predecessors.",
        "Analyze how media exposes, parent advocacy, and the disability rights movement influenced federal law.",
        "Relate historical exclusion to contemporary mandates (IDEA, ADA, Section 504, Olmstead).",
        "Critically evaluate why legal rights did not automatically produce equitable outcomes.",
    ]:
        bullet(pdf, obj)

    section_title(pdf, "1. Framing Concepts: Three Lenses on Disability")
    body(
        pdf,
        "Historians and disability studies scholars often describe three overlapping frameworks "
        "that shaped policy and classroom practice:",
    )
    for label, desc in [
        ("Medical / charity model", "Disability as individual defect; institutions and expert control; pity and dependence. Dominant early-mid century."),
        ("Eugenic model", "Disability as threat to national fitness; sterilization and segregation; Nazi state killing as extreme form. Peak 1910s-1940s."),
        ("Social / civil rights model", "Disability as barrier created by society; rights and access; self-advocacy (Nothing about us without us). Emerges 1970s+."),
    ]:
        subsection(pdf, label)
        pdf.set_font("Helvetica", "", 9)
        body(pdf, desc)

    section_title(pdf, "2. Early 20th Century (1900s-1930s): Segregation and Eugenics")
    subsection(pdf, "Mass Institutionalization")
    body(
        pdf,
        "State hospitals, asylums, and residential schools for people labeled feeble-minded, "
        "insane, epileptic, or defective expanded from 19th-century roots. Many residents were "
        "placed because they were poor, inconvenient to families, or considered uneducable\u2014not "
        "solely because of documented disability (National Park Service, disability history series).",
    )
    body(
        pdf,
        "Facilities were frequently overcrowded and underregulated. Reform ideals such as moral "
        "treatment (humane care, work, gardens) faded as states cut costs and adopted medicalized "
        "interventions including electroshock, hydrotherapy, and later lobotomies (thousands in the "
        "1940s\u20131950s).",
    )
    subsection(pdf, "Eugenics and Forced Sterilization")
    body(
        pdf,
        "Inspired by social Darwinism and anxiety about the cost of defectives, the U.S. eugenics "
        "movement gained support among scientists, educators, and policymakers. Indiana passed the "
        "first forced-sterilization law in 1907; dozens of states followed.",
    )
    bullet(
        pdf,
        "Buck v. Bell (1927): U.S. Supreme Court upheld compulsory sterilization of people "
        "deemed unfit, with Justice Holmes infamously declaring three generations of imbeciles "
        "are enough.",
    )
    bullet(
        pdf,
        "An estimated 60,000+ people were sterilized under state laws, disproportionately women, "
        "institutionalized people, poor people, and racial minorities; programs peaked in the "
        "1930s\u20131940s and continued in some states into the 1970s.",
    )
    subsection(pdf, "Education and Employment")
    body(
        pdf,
        "Most children with significant disabilities had no entitlement to public schooling. "
        "Segregated charity classes, residential training schools, and exclusion from typical "
        "community life were the norm. Adults faced unemployment, guardianship, and charity-based "
        "support rather than economic participation.",
    )
    body(
        pdf,
        "Implication for future teachers: the absence of a federal right to education before 1975 "
        "means two generations of adults were systematically under-educated\u2014a legacy that "
        "still affects families and communities.",
    )

    section_title(pdf, "3. Mid-Century (1930s-1950s): Extremes and Medical Control")
    subsection(pdf, "Nazi Germany: Aktion T4")
    body(
        pdf,
        "Nazi ideology extended eugenics to systematic murder. Under Aktion T4 (from 1939), "
        "people with disabilities were killed as life unworthy of life (lebensunwertes Leben). "
        "An estimated 200,000\u2013300,000 people were murdered in gas chambers and through "
        "starvation and overdose; killing technology and personnel later fed the Holocaust "
        "(United States Holocaust Memorial Museum).",
    )
    body(
        pdf,
        "International revulsion after World War II reduced open enthusiasm for eugenics in the "
        "U.S., but sterilization and institutionalization continued for decades.",
    )
    subsection(pdf, "U.S. Institutions at Scale")
    body(
        pdf,
        "Large state schools and psychiatric hospitals housed thousands. Conditions at facilities "
        "such as Willowbrook (New York) included severe overcrowding, inadequate food and "
        "sanitation, and lack of habilitation. Senator Robert Kennedy called Willowbrook a snake "
        "pit in 1965; by 1969 it held over 6,200 residents in space designed for roughly 4,000.",
    )
    body(
        pdf,
        "Researchers conducted unethical studies on residents (e.g., hepatitis exposure without "
        "meaningful consent), reflecting a culture that treated institutionalized people as subjects "
        "rather than rights-bearing citizens.",
    )

    section_title(pdf, "4. Late 20th Century (1960s-1990s): Rights, Law, and Uneven Integration")
    subsection(pdf, "Media Exposes, Litigation, and Parent Activism")
    body(
        pdf,
        "Television investigations and lawsuits transformed public opinion. Geraldo Rivera\u2019s "
        "1972 documentary Willowbrook: The Last Disgrace galvanized the disability rights movement. "
        "The Willowbrook Consent Decree (1975) mandated standards and phased closure (completed 1987). "
        "Similar reforms followed media exposes at Pennhurst and other institutions.",
    )
    body(
        pdf,
        "Parent organizations (e.g., ARC, formerly Association for Retarded Children), self-advocates, "
        "and civil rights allies demanded education in public schools, community living, and "
        "anti-discrimination protections.",
    )
    subsection(pdf, "Deinstitutionalization")
    body(
        pdf,
        "From the 1960s through the 1990s, psychiatric and developmental disability bed counts fell "
        "dramatically (roughly 90%+ reduction in public psychiatric beds since 1955). Drivers included "
        "new medications, cost pressures, civil rights advocacy, and court orders.",
    )
    body(
        pdf,
        "Critical caveat for educators: deinstitutionalization often outpaced funding for community "
        "supports. Many people experienced homelessness, nursing-home placement, or incarceration\u2014"
        "a pattern scholars call transinstitutionalization. Community integration requires services, "
        "not only discharge.",
    )
    subsection(pdf, "504 Sit-in and the Shift to Civil Rights")
    body(
        pdf,
        "In 1977, disability activists occupied federal buildings for 26 days to demand enforcement "
        "of Section 504 of the Rehabilitation Act (1973), which prohibited discrimination in federally "
        "funded programs. The sit-in reframed disability as a civil rights issue, not a charity problem.",
    )
    subsection(pdf, "Landmark Federal Legislation (U.S.)")
    milestones = [
        ("1968", "Architectural Barriers Act - accessibility in federal buildings."),
        ("1973", "Rehabilitation Act Section 504 - nondiscrimination in federal programs."),
        ("1975", "Education for All Handicapped Children Act (EHA; now IDEA) - FAPE in LRE; IEP; procedural safeguards."),
        ("1990", "Americans with Disabilities Act (ADA) - employment, public accommodations, state/local government."),
        ("1999", "Olmstead v. L.C. - unjustified institutional segregation violates ADA; community services when appropriate."),
    ]
    for year, desc in milestones:
        bullet(pdf, f"{year}: {desc}")

    section_title(pdf, "5. Heterogeneous Experiences Within Disability")
    body(
        pdf,
        "Disability is not a single experience. Historical treatment varied by impairment type, "
        "race, class, gender, and geography:",
    )
    bullet(
        pdf,
        "Intellectual and developmental disabilities: most targeted by eugenics and long-term "
        "institutionalization; slowest path to inclusive schooling.",
    )
    bullet(
        pdf,
        "Psychiatric disabilities: asylum era, deinstitutionalization, ongoing debates on coercion, "
        "supported decision-making, and homelessness.",
    )
    bullet(
        pdf,
        "Physical and sensory disabilities: exclusion from schools and jobs; later gains from "
        "accessibility standards and assistive technology.",
    )
    bullet(
        pdf,
        "Intersectionality: sterilization and institutionalization disproportionately harmed women, "
        "poor people, and communities of color.",
    )

    section_title(pdf, "6. Implications for Special Education Majors")
    subsection(pdf, "Why History Matters in Your Placement")
    for item in [
        "LRE and inclusion are legal and ethical responses to centuries of unnecessary segregation.",
        "Family distrust of schools may reflect historical exclusion; partnership requires cultural humility.",
        "Person-centered planning and student voice extend the disability rights slogan nothing about us without us.",
        "Institutional logic (compliance-only, deficit-only labels) can persist inside schools even after institutions close.",
        "Advocacy skills (data, law, collaboration) continue to matter because rights without resources remain fragile.",
    ]:
        bullet(pdf, item)

    subsection(pdf, "Reflection Questions for Seminar")
    for q in [
        "How does knowing about Buck v. Bell change how you interpret current debates about guardianship or supported decision-making?",
        "In what ways might a school replicate institutional assumptions (segregation, control, low expectations) without intending to?",
        "What would fully funded Olmstead-style community integration require in your local school district?",
        "How do media portrayals of disability today echo or challenge 20th-century stereotypes?",
    ]:
        bullet(pdf, q)

    section_title(pdf, "7. Historiographic Summary")
    body(
        pdf,
        "1. Early to mid-20th century: Society often treated disabled people as problems to contain, "
        "cure, or eliminate\u2014through institutions, sterilization, and abusive care.",
    )
    body(
        pdf,
        "2. Nazi genocide represented the most extreme eugenic logic; it did not end discrimination elsewhere.",
    )
    body(
        pdf,
        "3. Late 20th century: Rights, federal law, and closure of notorious institutions\u2014driven by "
        "disabled activists, families, journalists, and courts.",
    )
    body(
        pdf,
        "4. Legal equality did not equal full inclusion; inadequate community services and discrimination "
        "persist into the 21st century.",
    )

    section_title(pdf, "References and Further Reading")
    refs = [
        "American Bar Association. Disability Rights Timeline. americanbar.org/groups/diversity/disabilityrights",
        "National Park Service. Disability History: Early and Shifting Attitudes of Treatment. nps.gov/articles/disabilityhistoryearlytreatment.htm",
        "National Park Service. Disability Rights Movement. nps.gov/articles/disabilityhistoryrightsmovement.htm",
        "Smithsonian National Museum of American History. Eugenics exhibition. americanhistory.si.edu",
        "U.S. Commission on Civil Rights. Chapter 1, Americans with Disabilities Act. usccr.gov",
        "U.S. Dept. of Health and Human Services. Olmstead and community integration. hhs.gov/civil-rights",
        "United States Holocaust Memorial Museum. Eugenics. encyclopedia.ushmm.org",
        "Lombardo, P. & et al. (scholarly work on Buck v. Bell and sterilization). See also Paul Lombardo, Three Generations, No Imbeciles.",
        "Minnesota Governor's Council on Developmental Disabilities. Parallels in Time. state.mn.us/mnddc/parallels",
        "National Council on Disability. Willowbrook 40th anniversary resources. ncd.gov",
        "Stern, A. M. & et al. Annual Review of Genomics: Eugenics and involuntary sterilization, 1907-2015.",
    ]
    pdf.set_font("Helvetica", "", 9)
    for i, ref in enumerate(refs, 1):
        pdf.multi_cell(0, 5, t(f"[{i}] {ref}"))
        pdf.ln(1)

    pdf.ln(6)
    pdf.set_font("Helvetica", "I", 9)
    pdf.set_text_color(80, 80, 80)
    pdf.multi_cell(
        0,
        5,
        "Document generated for educational use. Verify URLs and cite primary sources "
        "in course assignments per your instructor's preferred style (APA 7 recommended).",
    )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    pdf.output(str(output_path))
    print(f"Wrote {output_path}")


if __name__ == "__main__":
    out = (
        Path(__file__).resolve().parent.parent
        / "src"
        / "site"
        / "notes"
        / "Pedagogy"
        / "Society_and_Disability_20th_Century.pdf"
    )
    build_pdf(out)
