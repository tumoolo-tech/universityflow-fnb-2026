# Computer Science module topics: UJ, Wits, UCT (research draft)

**DRAFT. Researched 2026-10-23 by a research agent. Not verified by a person (hard rule 3).**
Nothing here may reach a student until a person has opened each source, checked each row and
recorded `verifiedOn`/`verifiedBy` on the catalogue record it becomes. Agents never add those.

Purpose: the published topics of each Computer Science module, years 1 to 3 (and honours where
the same document prints them), so the portfolio planner can suggest projects from what a student
is actually taught. The topics are what the university prints; the planner decides nothing from
them about admission or progression.

How to read this file:

- **Topics** are a short keyword list taken from the module's printed outline, in the outline's
  own terms. Where a phrase is quoted it is in "quotes" and kept short; the rest is a list of the
  terms the outline names, not a rewording of it. Nothing is added that the outline doesn't name.
- **"not published"** means the source opened and does not print the value (gotcha 40: never
  fill a field with a guess or a default).
- **"not opened"** means the source could not be read by an agent (UJ: see below). Nothing in a
  "not opened" row is a fact yet.
- **PDF page** is the page number in the PDF file (what `#page=N` opens); **printed page** is the
  number on the page. Both are given because they differ.
- **Credits** are NQF credits as printed. **Term** is recorded only where the source defines it
  (UCT's code suffix); Wits's rule book prints no term, so none is given.
- Every module also has a `sourceUrl` + `academicYear` below so a row can become a catalogue
  draft (`packages/catalogue/src/data/*-curricula.ts` style) without re-research.

---

## 1. Wits: Bachelor of Science in the field of Computer Science (SBA13)

Catalogue programme: `wits-bsc-computer-science` (its first-year curriculum is held back; see
`packages/catalogue/src/data/wits-curricula.ts`, the APPM1026A term question).

**Source:** 2026 Senate Rules and Syllabuses for the Faculty of Science (`Sci_eBook.pdf`),
<https://www.wits.ac.za/media/wits-university/students/academic-matters/documents/Sci_eBook.pdf>.
`academicYear: 2026`. Read 2026-10-23 (downloaded and read in full as text).

- Curriculum (which modules in which year): rule for SBA13, PDF pages 58–59 (printed 56–57).
  Total NQF credits printed: 432.
- Module credits and NQF levels: Computer Science course table, PDF pages 45–46 (printed 43–44).
- Module outlines (topics): "2026 Syllabuses for the Faculty of Science", PDF pages 176–180
  (printed 174–178); honours outlines from PDF page 180 onwards.
- Every COMS module has a part-time (PT) twin code with the same outline; listed in brackets.

### Year 1 (Computer Science I)

| Code | Name | Credits | NQF | Published topics | PDF p. |
|---|---|---|---|---|---|
| COMS1015A (PT COMS1019A) | Basic Computer Organisation I | 9 | 5 | number systems; data representation (compression, binary formats, character sets, sound, image, video formats); gates and circuits (Boolean expressions, truth tables, logic diagrams); the Von Neumann machine and parallel configurations; low-level programming in assembly and machine language; operating systems (memory management, process management, CPU scheduling) | 176 |
| COMS1016A (PT COMS1020A) | Discrete Computational Structures I | 9 | 5 | discrete mathematics for computer science: sets, logic, induction, relations, finite automata, Turing machines, computability theory; reading and constructing mathematical arguments | 176–177 |
| COMS1017A (PT COMS1021A) | Introduction to Data Structures and Algorithms I | 9 | 5 | arrays, linked lists, stacks, queues, tree structures, binary search trees, AVL trees, hashing, heaps, basic searching and sorting; time and space complexity; "practical C++ implementations", array- and pointer-based | 177 |
| COMS1018A (PT COMS1022A) | Introduction to Algorithms and Programming I | 9 | 5 | algorithmic problem solving with sequencing, selection, repetition and abstraction; translating algorithms into C++ programs; parameter passing, static and dynamic array allocation, pointer arithmetic | 177 |

Also in year 1 (not Computer Science, listed for completeness, outlines not researched here):
MATH1034A Algebra I (15), MATH1036A Calculus I (21), APPM1026A Mathematical Methods and
Modelling I (12), APPM1028A Mechanics I (12), APPM1030A Scientific Computing I (12), and "One
additional course yielding a minimum of 36 level I credits as listed in 2.1.2.6".

Not in the SBA13 curriculum but in the same table (service courses for other programmes):
COMS1025A Auxiliary Computer Science and Programming IA (9; topics: basic syntax and semantics,
variables and primitive types, expressions, simple and file I/O, control structures, functions and
parameter passing, recursion) and COMS1026A Auxiliary Computer Science and Programming IB (9;
topics: simple algorithm and program design, "basics of classes and Object Orientation", ADTs:
arrays, lists, stacks, queues, priority queues, sets, maps, dictionaries/hashtables, trees, graphs;
data analysis and visualisation libraries; common data formats). PDF page 177.

### Year 2 (Computer Science II)

| Code | Name | Credits | NQF | Published topics | PDF p. |
|---|---|---|---|---|---|
| COMS2002A (PT COMS2018A) | Database Fundamentals II | 12 | 6 | database design and implementation: entities, keys, relationships, dependency, relationship strength, supertypes, subtypes, transactions; "implemented in the forms of projects" | 177–178 |
| COMS2013A (PT COMS2019A) | Mobile Computing II | 12 | 6 | Java and object-oriented programming; Android development: activities, intents, views, sensors, APIs (location, GPS, maps), UI and app basics, widgets, persistence, network and web services | 178 |
| COMS2014A (PT COMS2020A) | Computer Networks II | 12 | 6 | network structure and components, packet switching, layered architectures; web/HTTP, VoIP, peer-to-peer file sharing, socket programming; TCP/IP, reliable transfer, flow and congestion control; naming, addressing, routing; Ethernet and switches; wireless networks; network security | 178 |
| COMS2015A (PT COMS2021A) | Analysis of Algorithms II | 12 | 6 | algorithmic analysis and design; graph representation; spanning and search trees; shortest path; connectivity, bicomponents, strongly connected components; PERT; Eulerian and Hamiltonian circuits; planarity and colouring; flows; matching and stable marriage | 178 |

Also in year 2 (not Computer Science): MATH2001A, MATH2007A, MATH2015A, MATH2016A, MATH2019A,
STAT2012A (8 credits each) and APPM2021A, APPM2023A, APPM2025A (16 each), as printed in the
SBA13 rule (the rule's choice wording between these was not checked: see gaps).

Not in SBA13: COMS2017A Auxiliary Database Systems II (12; topics: relational schema from
conceptual models, entity and referential integrity, relational algebra, functional dependency,
normal forms 1NF to 4NF/BCNF, SQL queries, stored procedures and functions, transactions and
concurrency control). PDF page 178.

### Year 3 (Computer Science III and Computational Applications III)

The SBA13 rule lists two groups. Which and how many a student takes from each was **not checked**
(the PDF's table text doesn't make the choice rule readable as extracted: see gaps). One printed
rule is clear: "either Software Engineering (COMS3002A/COMS3019A) or Software Design
(COMS3009A/COMS3028A), but not both" (PDF page 46).

Computer Science III:

| Code | Name | Credits | NQF | Published topics | PDF p. |
|---|---|---|---|---|---|
| COMS3005A (PT COMS3022A) | Advanced Analysis of Algorithms III | 18 | 7 | advanced search and sort, greedy algorithms, dynamic programming, closest pair of points, complexity classes (P, NP, NP-completeness), backtracking, A* search; theoretical and empirical analysis | 179 |
| COMS3003A (PT COMS3021A) | Formal Languages and Automata III | 18 | 7 | regular languages, context-free grammars, pumping lemmata, regular expressions, finite automata, pushdown automata | 179 |
| COMS3009A (PT COMS3028A) | Software Design III (or COMS3002A) | 18 | 7 | object-oriented analysis and design, functional decomposition, event-driven design, aspect- and service-oriented architectures, design patterns, test-driven development; "a large software project" | 180 |
| COMS3002A (PT COMS3019A) | Software Engineering III (or COMS3009A) | 18 | 7 | software engineering history; the software life-cycle; document-driven, agile and hybrid methodologies; software processes (CMMI, TSP); project planning and cost estimation; UML; project management tools; quality assurance and testing; maintenance | 179 |
| COMS3010A (PT COMS3023A) | Operating Systems and System Programming III | 18 | 7 | processes and interprocess communication, multithreaded programming, memory allocation, resource allocation and scheduling, file systems and persistent storage, protection and security; system programming and kernel interfaces | 180 |

The course table prints the codes COMS3002A1, COMS3019A1, COMS3009A1 and COMS3028A1, where the
superscript "1" is the footnote mark for the either/or rule, not part of the code (inferred from
the footnote; a person should confirm).

Computational Applications III:

| Code | Name | Credits | NQF | Published topics | PDF p. |
|---|---|---|---|---|---|
| COMS3007A (PT COMS3024A) | Machine Learning III | 18 | 7 | supervised, unsupervised and reinforcement learning; classification, regression, clustering, optimisation; mathematical and statistical motivation and implementation | 179 |
| COMS3006A (PT COMS3025A) | Computer Graphics and Visualisation III | 18 | 7 | rendering, linear algebra, graphical modelling, animation, visualisation, computational geometry; file formats, hardware interfaces, APIs | 179 |
| COMS3008A (PT COMS3026A) | Parallel Computing III | 18 | 7 | CPU and GPU architectures, interconnects, parallel memory; programming with MPI, shared memory and general-purpose GPUs; load balancing, communication, synchronisation overhead; parallel numerical algorithms | 180 |
| COMS3011A (PT COMS3027A) | Software Design Project III | 18 | 7 | applying system design principles, design paradigms, design patterns, testing and TDD in "a real world software design and implementation project", continuously assessed | 180 |

### Honours (BSc Hons, COMS4xxx; same document, PDF pages 180 onwards)

Names and credits as printed; topics not extracted module by module (outlines are printed; a
follow-up can add them). NQF level not recorded here.

| Code | Name | Credits |
|---|---|---|
| COMS4030A | Adaptive Computation and Machine Learning IV | 12 |
| COMS4032A | Applications of Algorithms IV | 12 |
| COMS4033A | Artificial Intelligence IV | 12 |
| COMS4036A | Computer Vision IV | 12 |
| COMS4040A | High Performance Computing and Scientific Data Management IV | 12 |
| COMS4041A | Human Computer Interaction IV | 12 |
| COMS4043A | Multi-agent Systems IV | 12 |
| COMS4045A | Robotics IV | 12 |
| COMS4047A | Special Topics in Computer Science IV | 12 |
| COMS4048A | Data Analysis and Exploration IV | 12 |
| COMS4050A | Discrete Optimisation IV | 12 |
| COMS4054A | Natural Language Processing IV | 12 |
| COMS4055A | Mathematical Foundations of Data Science IV | 12 |
| COMS4057A | Introduction to Research Methods IV | 6 |
| COMS4058A | Research Project: Big Data Analytics IV | 36 |
| COMS4059A | Research Project: Computer Science IV | 36 |
| COMS4060A | Introduction to Data Visualisation and Exploration IV | 12 |
| COMS4061A | Reinforcement Learning IV | 12 |
| COMS4062A | Probabilistic Graphical Models IV | 12 |
| COMS4063A | Research Project: Cybersecurity IV | 30 |
| COMS4064A | Cybersecurity IV | 12 |
| COMS4065A | Cryptography IV | 12 |
| COMS4066A | Secure Systems Design and Analysis IV | 12 |
| COMS4067A | Offensive Security and Ethical Hacking IV | 12 |
| COMS4068A | Data Privacy and Ethics IV | 12 |
| COMS4069A | Computational Intelligence IV | 12 |
| COMS4070A | Computational Neuroscience IV | 12 |

Which honours modules belong to which honours programme (CS, Big Data, Cybersecurity) was not
researched.

---

## 2. UCT: BSc, Major in Computer Science (CSC05)

Catalogue programme: `uct-bsc-computer-science` (first-year curriculum held back: no first-year
credit total is published; see `packages/catalogue/src/data/uct-curricula.ts`).

**Source:** University of Cape Town, Faculty of Science Handbook 2026 (Handbook 11),
<https://uct.ac.za/sites/default/files/media/documents/2026-sci-handbook-11-final-web.pdf>.
`academicYear: 2026`. Read 2026-10-23 (downloaded and read in full as text; the download dropped
twice and was resumed, so a person should confirm the file opens whole).

- Major structure (core courses per year): "Major in Computer Science [CSC05]", PDF pages 27–28
  (printed 26–27). Also "Major in Artificial Intelligence [CSC08]", PDF page 23 (printed 22).
- Course outlines (topics): Department of Computer Science, "Undergraduate Courses", PDF pages
  102–108 (printed 101–107); honours PDF pages 108–116.
- Term: the handbook defines the code suffix: F first semester, S second semester, H and W whole
  year, Z "other" (not a term). Recorded as that letter only.

### Year 1

| Code | Name | Term | Credits | NQF | Published topics | PDF p. |
|---|---|---|---|---|---|---|
| CSC1015F/S | Computer Science 1015 | F or S | 18 | 5 | problem solving, algorithm development and programming in Python; I/O, conditionals, loops, strings, functions, arrays, lists, dictionaries, recursion, text files, exceptions; testing and debugging; sorting and searching; algorithm complexity, equivalence classes; number systems, binary arithmetic, Boolean algebra, logic gates; blended learning (online video lectures) | 103 |
| CSC1016S | Computer Science 1016 | S | 18 | 5 | object-oriented design and programming in Java; OO design techniques and UML diagrams; lists, stacks, queues; Human Computer Interaction and interface design; practicals: inheritance, polymorphism, interfaces, generics, GUI programming in Java | 103–104 |
| CSC1010H | Computer Science 1010 (slower-paced route, from week 7, by permission) | H | 18 | 5 | same outline as CSC1015F (Python) | 102 |
| CSC1011H | Computer Science 1011 (follows CSC1010H) | H | 18 | 5 | first half: Python problem solving; second half: OO design and programming in Java, UML, lists, stacks, queues, HCI and interface design; inheritance, polymorphism, interfaces, generics, GUI programming | 102–103 |

Printed rule (PDF page 102): CSC1010H and CSC1011H are equivalent to CSC1015F/S and CSC1016S, and
credit is not given for both pairs. Year-1 maths in CSC05: MAM1008S or MAM1019H or a STA100x
course, and MAM1004F/S or MAM1000W or MAM1031F (choice wording as printed; outlines not
researched here).

### Year 2

| Code | Name | Term | Credits | NQF | Published topics | PDF p. |
|---|---|---|---|---|---|---|
| CSC2001F | Computer Science 2001 | F | 24 | 6 | abstract data types and assertions, recursive algorithms, AVL and B-trees, graph traversals, minimum spanning trees, sets, hashing, priority queues; conceptual modelling, database design, relational database manipulation; Java in a Unix environment | 104 |
| CSC2002S | Computer Science 2002 | S | 24 | 6 | concurrent and parallel computing (Java); computer architecture; Society, Ethics and the Profession (property rights, freedom of expression, privacy, free and open source software); Theory of Computing (Turing machines, limits of computation) | 104 |
| CSC2004Z | Programming Assessment | not a term (Z) | 0 | 6 | a practical programming examination to "assess and confirm mastery in fundamental programming skills"; required for the major and for third-year CS | 105 |
| INF2009F or CSC2042S | Systems Analysis (INF2009F, 18) or AI 2: Machine Learning (CSC2042S, 24) | F / S | 18 / 24 | 6 | CSC2042S: fundamental machine learning algorithms implemented in Python with ML frameworks; problem formulation, feature representations, evaluation. INF2009F: outline is in the Commerce handbook, not researched here | 106 |

Other second-year CS courses in the same handbook (not CSC05 core):
- CSC2041F Introduction to AI 1: Knowledge Representation (24, NQF 6; AI major core): logical
  agents; symbolic and logical representations; inference in propositional and first-order logic;
  computational logic and automated reasoning; tableau, case-based, constraints, SAT solving;
  random variables, probabilistic inference, utility functions. PDF page 105.
- CSC2005F/S Independent Research in Computer Science (24, NQF 7; selective, by application):
  research methods, proposal and report, a supervised research project. PDF page 105.

### Year 3

| Code | Name | Term | Credits | NQF | Published topics | PDF p. |
|---|---|---|---|---|---|---|
| CSC3002F | Networks and Operating Systems | F | 36 | 7 | computer networks including layers of the ISO OSI model and network security; structure and function of modern operating systems | 106 |
| CSC3003S | Advanced Programming & Algorithms | S | 36 | 7 | software development; functional programming; theory of algorithms (categories of algorithms and analysing their complexity) | 106–107 |

Other third-year CS courses in the same handbook (not CSC05 core):

| Code | Name | Term | Credits | NQF | Published topics | PDF p. |
|---|---|---|---|---|---|---|
| CSC3024S | Introduction to C++ Programming | S | 18 | 7 | modern C++: pointers, stream operations, RAII, operator overloading, templates, the STL; the C++ memory model and move semantics | 107 |
| CSC3041F | AI: Automated Planning and Control (AI major) | F | 18 | 7 | uninformed, heuristic and adversarial search; reinforcement learning, Markov Decision Processes, policy search, data-driven control; game playing, planning, robot navigation and control | 107 |
| CSC3042F | AI: Deep Learning (AI major) | F | 18 | 7 | deep feedforward, convolutional and recurrent networks, Transformers; scalable deep learning systems; NLP and computer vision applications; ML ethics (dataset and algorithmic bias) | 107–108 |
| CSC3043S | AI: Reasoning in AI (AI major) | S | 18 | 7 | reasoning with Large Language Models; visual reasoning with diffusion models; Bayesian networks; logic programming; expert systems | 108 |
| CSC3044S | AI: AI Systems (AI major) | S | 18 | 7 | agent architectures (cognitive architectures, collaborative and information-gathering agents); human-agent interaction; societal impacts of AI; "a practical AI system development capstone project" | 108 |

Note: a course's name can differ between UCT handbooks. The Science handbook calls CSC3002F
"Networks and Operating Systems"; another 2026 UCT handbook calls it "Computer Science 3002"
(seen in a search result only, not opened). Record the Science handbook's course-entry heading.

### Honours (BSc Hons specialising in Computer Science; PDF pages 108–116)

Entry printed (PDF page 108): a UCT CS major "with an average of at least 60% in both CSC3002F and
CSC3003S, or permission from the Head of Department". Names and credits as printed; topics as a
short keyword list from each outline's opening.

| Code | Name | Credits | Published topics (opening of outline) |
|---|---|---|---|
| CSC4002W | Computer Science Honours Project (compulsory) | 60 | year-long supervised research project, mini-dissertation |
| CSC4019Z | Research & Innovation | 16 | professional communication, writing, basic research methodology |
| CSC4007Z | Selected Honours Module in Computer Science | 12 | emerging advanced topics |
| CSC4010Z | Advanced Topics in Computer Science Honours 2 | 12 | emerging advanced topics, department research specialisations |
| CSC4013Z | Visualisation | 12 | visualisation of large multidimensional data; human perception |
| CSC4020Z | Functional Programming | 12 | functional paradigm, lambda calculus, computability |
| CSC4021Z | Compilers 1 | 12 | language classes, formal grammars, recursive descent parsing, tokenisers |
| CSC4022Z | Compilers 2 | 12 | semantic analysis, activation records, intermediate code, optimisations |
| CSC4023Z | Big Data Management & Analysis | 12 | very large databases; relational, NoSQL, Hadoop, data mining tools |
| CSC4024Z | Human Computer Interaction | 12 | user-centred design and evaluation of interactive systems |
| CSC4025Z | Artificial Intelligence | 12 | logic, search, optimisation, statistics; problem solving, knowledge representation |
| CSC4026Z | Network & Internetwork Security | 12 | cryptographic techniques and protocols; risk (ISO27000, PoPI act); security services; encryption |
| CSC4027Z | Computer Game Design | 12 | game programming concepts; design and implement simple 2D and 3D games |
| CSC4028Z | High-Performance Computing | 12 | parallel processing; architecture, languages, system software, benchmarking |
| CSC4029Z | Introduction to Computer Graphics | 12 | 3D graphics theory; OpenGL and GLSL shader programming |
| CSC4040Z | Logics for Artificial Intelligence | 12 | propositional logic, description logics, tableaux, ontologies |
| CSC4041Z | Non-Monotonic Reasoning | 12 | non-monotonic reasoning, theory and state of the art |
| CSC4042Z | Answer Set Programming | 12 | logic programming in a fragment of first-order logic |
| CSC4043Z | Evolutionary Computation | 12 | genetic algorithms, genetic programming, evolutionary algorithms for optimisation |
| CSC4044Z | Artificial Life | 12 | simulation of living and adaptive systems, robotics |

How many honours modules a student takes and which are offered in 2026 is in the honours rules
and the department's own handbook ("available from the department"), not researched here.

---

## 3. UJ: BSc Information Technology (Computer Science and Informatics)

Catalogue programmes: `uj-bsc-it-computer-science`, `uj-bsc-it-computer-science-extended`.

**Status: not opened. No topics recorded.** Every uj.ac.za URL tried on 2026-10-23 returned
HTTP 403 with a Cloudflare "Just a moment..." JavaScript challenge, to both the agent's fetcher and
a plain download: the 2026 APK undergraduate yearbook, the 2026 postgraduate yearbook, the
Academy of Computer Science and Software Engineering "Undergraduate Courses" page, the Science
yearbooks page and the 2026 assessments timetable. The challenge was not bypassed. This matches
the earlier note that uj.ac.za refuses automated access.

What a web search index said about these documents (search-result summaries only; **nothing below
was read in the source; every item is unverified and must not become a catalogue value without a
person opening the document**):

| Code (per search result) | Name (per search result) | Year | Credits | Topics |
|---|---|---|---|---|
| CSC01A1 | Computer Science 1A (indexed as "Introduction to algorithm development (C++)") | 1 | not opened | not opened |
| CSC01B1 | Computer Science 1B (indexed as an introduction to data structures in C++; prerequisite CSC01A1) | 1 | not opened | not opened |
| IFM01A1 | Informatics 1A (indexed as "Introduction to Algorithm Development (Vb)", a 2020 exam-paper title) | 1 | not opened | not opened |
| CSC02A2, CSC02B2 | Computer Science 2A, 2B | 2 | not opened | not opened |
| IFM02A2 | Informatics 2A | 2 | not opened | not opened |
| CSC03A3, CSC03B3 | Computer Science 3A, 3B | 3 | not opened | not opened |
| IFM03A3 | Informatics 3A | 3 | not opened | not opened |

The codes appear in the search index of the 2026 assessments timetable; the "1B" and "B" Informatics
codes and every credit value were not seen. Past exam papers in UJ's repository
(repository.uj.ac.za, ujcontent.uj.ac.za) show some content (a 2024 Computer Science 2A paper
indexed as covering Java, GUIs and the Observer pattern), but an exam paper is not a published
module outline and is not a source for topics.

---

## Sources

| # | University | Document | URL | Academic year | Read | Status |
|---|---|---|---|---|---|---|
| S1 | Wits | 2026 Senate Rules and Syllabuses, Faculty of Science | <https://www.wits.ac.za/media/wits-university/students/academic-matters/documents/Sci_eBook.pdf> | 2026 | 2026-10-23 | opened, read in full |
| S2 | UCT | Faculty of Science Handbook 2026 (Handbook 11) | <https://uct.ac.za/sites/default/files/media/documents/2026-sci-handbook-11-final-web.pdf> | 2026 | 2026-10-23 | opened, read in full (download resumed twice) |
| S3 | UJ | Faculty of Science APK Undergraduate Yearbook 2026 | <https://www.uj.ac.za/wp-content/uploads/2026/02/final-2026-science-apk-undergraduate-yearbook-jan2026.pdf> | 2026 | 2026-10-23 | **not opened: 403 (Cloudflare challenge)** |
| S4 | UJ | Faculty of Science Postgraduate Yearbook 2026 (honours) | <https://www.uj.ac.za/wp-content/uploads/2026/02/final-2026-science-postgraduate-yearbook-jan2026.pdf> | 2026 | 2026-10-23 | **not opened: 403** |
| S5 | UJ | Academy of CS and Software Engineering, Undergraduate Courses | <https://www.uj.ac.za/faculties/science/departments-2/academy-of-computer-science-and-software-engineering/courses-and-programmes/undergraduate-courses/> | not known | 2026-10-23 | **not opened: 403** |
| S6 | UJ | Academy of CS and Software Engineering, Honours Courses | <https://www.uj.ac.za/faculties/science/departments-2/academy-of-computer-science-and-software-engineering/courses-and-programmes/honours-courses/> | not known | 2026-10-23 | **not opened: 403** |
| S7 | UJ | 2026 assessments and exams timetable (module codes) | <https://www.uj.ac.za/wp-content/uploads/2021/09/uj-assessments-and-exams-2026.pdf> | 2026 | 2026-10-23 | **not opened: 403** (codes seen in search index only) |

## Gaps and what a person must check

1. **UJ, everything.** Open S3 in a browser and record, for the BSc IT (Computer Science and
   Informatics) and its extended version: each CSC and IFM module's code, name, NQF level,
   credits, semester and the yearbook's module purpose/content/outcomes, with the PDF page. Then
   S4/S6 for honours. Confirm the codes in the UJ table above; none is verified.
2. **Wits year-3 choice rule.** PDF pages 58–59 of S1 list Computer Science III and Computational
   Applications III modules; read the SBA13 rule text for how many a student takes from each and
   which are compulsory. Only the Software Engineering / Software Design either-or is recorded.
3. **Wits year-2 maths choice.** The SBA13 table lists six MATH/STAT and three APPM year-2 modules;
   check whether all are required or a choice.
4. **Wits footnote codes.** Confirm COMS3002A1/COMS3009A1 etc. are COMS3002A/COMS3009A with a
   footnote mark (PDF page 45–46).
5. **Wits `Sci_eBook.pdf` has no year in its URL.** Wits may replace it with the 2027 book at the
   same address; record the year from the cover when re-checking, and keep a dated copy reference.
6. **Wits honours topics** are printed (S1 PDF pages 180 onwards) but were not extracted per module.
7. **UCT download.** S2 came down in three parts (connection dropped); confirm the PDF opens whole
   and that the pages cited match.
8. **UCT CSC2004Z, INF2009F.** INF2009F Systems Analysis is an alternative to CSC2042S in CSC05
   year 2; its outline is in the Commerce handbook (not researched).
9. **UCT honours.** Which modules run in 2026 and how many a student takes: honours rules in the
   handbook front section and the department's own honours handbook.
10. **Terms.** Wits prints no term per module in S1 (same as gotcha 40's finding in
    `wits-curricula.ts`); none is recorded. UCT's are from the code suffix the handbook defines.
11. **Topics are descriptions, not guarantees.** Outlines say what a course covers; lecturers vary
    detail year to year. The planner should present them as "your course outline lists ..." with
    the source, never as what the student will definitely do.
12. **Verification fields.** No row here has `verifiedOn`/`verifiedBy`; a person adds those on the
    catalogue record after checking (hard rule 3).
