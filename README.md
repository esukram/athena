# **Athena 🦉**

A customizable, structure-first application for mastering new topics through index-card style learning.

## **📖 About The Project**

**Athena** is designed to give learners control over their training material. Unlike rigid learning platforms, Athena allows users to build their own curriculum from the ground up. Whether you are learning a new language, studying for certifications, or onboarding employees, Athena provides the framework to organize complex topics into manageable, bite-sized "index cards."

### **Core Philosophy**

1. **Structure First:** Knowledge is easier to retain when it is organized hierarchically.
2. **Active Recall:** Using an index-card/flashcard interface to test knowledge rather than just passively reading it.
3. **User-Driven Content:** The user is the architect of their own learning path.

## **🗂️ Content Structure**

Athena uses a strict three-tier hierarchy to keep learning materials organized:

1. **Course / Lecture:** The top-level container for a specific subject (e.g., "Advanced Biology" or "Introduction to Python").
2. **Chapter:** Logical subdivisions within a Course to group related concepts (e.g., "Cell Structures" or "List Comprehensions").
3. **Index Card:** The atomic unit of learning. A Question & Answer combination used for study and evaluation.

## **✨ Key Features**

- **Topic Management:** Create high-level subjects and drill down into specific sub-topics.
- **Index-Card Interface:**
  - Front/Back card design for questions and answers.
  - Support for rich text, code snippets, and images.
- **Voice Interaction & Evaluation:** The app reads questions aloud, allows users to respond via voice, and provides AI-driven evaluation on correctness and feedback.
- **Training Mode:** Specific modes for reviewing cards (e.g., Shuffle, Spaced Repetition).
- **Progress Tracking:** Visual indicators of mastery for each topic.

## **🛠️ Tech Stack**

- **Language:** TypeScript (Full Stack)
- **Frontend:** React.js
- **Design System:** Google Material 3 Design System (@material/web)
- **Backend:** Node.js
- **API:** tRPC and Fastify
- **Database:** SQLite
- **Testing:** vitest

See [ARCHITECTURE.md](ARCHITECTURE.md) for more information on the architecture of the application.

## **🚀 Getting Started**

### **Prerequisites**

- Node.js (v18 or higher)
- pnpm

### **Installation**

1. Clone the repository:  
   git clone [https://github.com/esukram/athena.git](https://github.com/esukram/athena.git)

2. Navigate to the project directory:  
   cd athena

3. Install dependencies:
   pnpm install

4. Start the development server:
   pnpm dev

## **📄 License**

Distributed under the GNU Affero General Public License v3.0. See [LICENSE](LICENSE) for more information.
