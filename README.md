# College portal

Build a simple University Result Management Demo System for presenting to stakeholders.

The system should simulate a basic academic result processing portal like a Nigerian university system such as Taraba State University.

This is ONLY a demo system focused on result entry, GPA/CGPA calculation, and result export.

🧠 CORE PURPOSE

The system is for an admin to:

Enter student results

Assign courses per semester

Automatically calculate GPA and CGPA

View past semester results

Export results to Excel (spreadsheet format)

👨‍💼 ADMIN FEATURES (ONLY ROLE FOR DEMO)

Admin can:

📌 1. Setup Academic Structure

Create Academic Session (e.g. 2023/2024)

Select Semester:

First Semester

Second Semester

Select Level:

100 Level

200 Level

300 Level

400 Level

📌 2. Course Setup

Admin can:

Add Course Code (e.g. CSC101)

Add Course Title

Assign Course Unit

Assign Level

Assign Semester

📌 3. Student Management

Admin can:

Add students

Enter:

Name

Matric Number

Level

📌 4. Result Entry

Admin can select:

Session

Semester

Course

Then for each student:

Enter CA Score

Enter Exam Score

System automatically calculates:

Total Score = CA + Exam

Grade (A–F)

Grade Point

📊 GRADING SYSTEM

70–100 = A

60–69 = B

50–59 = C

45–49 = D

40–44 = E

0–39 = F

🧮 GPA CALCULATION

GPA = \frac{\sum (Grade\ Point \times Course\ Unit)}{\sum Course\ Units}

🧮 CGPA CALCULATION

CGPA = \frac{\sum Total\ Grade\ Points}{\sum Total\ Units}

🧑‍🎓 STUDENT RESULT LOGIC (DEMO)

Student may have:

First Semester only (initial stage)

Second Semester later

System must:

Store results per:

Session

Semester

Level

Example:

100 Level First Semester → stored independently

100 Level Second Semester → stored separately

200 Level First Semester → new record group

📁 RESULT VIEWING (ADMIN DEMO)

Admin can:

Select Session

Select Semester

Select Level

Then system displays:

Student list

Courses

CA, Exam, Total

GPA per semester

CGPA overall

📊 EXCEL EXPORT FEATURE

Admin can click:

👉 “Export Result Sheet”

System generates Excel file containing:

| Matric No | Name | Course | CA | Exam | Total | Grade | Unit |

File must be downloadable.

🧠 IMPORTANT RULE (SIMPLICITY FOR DEMO)

No carryover logic yet

No approvals

No multi-admin roles

No complex workflows

ONLY:

Input → Calculate → Store → Display → Export

🎯 DEMO GOAL

The purpose of this system is to demonstrate:

How results are entered

How GPA and CGPA are calculated automatically

How results are organized by semester and session

How Excel result sheets are generated

How a real university-style system will work

💬 FINAL OUTPUT EXPECTATION

The system should feel like:

“A simple but functional university result portal where admin can enter results and instantly generate structured academic reports.”

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://gradely-suite.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/8973f093-6041-4d6b-88e4-1a484c5688da).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
