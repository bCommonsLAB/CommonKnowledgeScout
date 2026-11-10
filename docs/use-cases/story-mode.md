# Ask questions in story mode

## What you achieve

You ask a question in your own words and get an answer written from the documents of the library, with a numbered reference to every document it used. You can check each statement against its source.

## Before you start

- The library has published documents (see [Transform files into documents](transform-files.md)).
- For visitors without an account, the library is public (see [Publish a gallery and a website](publish.md)).

## Open story mode

- Choose **Story Mode** in the navigation of the library, or
- click **View in Story Mode** in the gallery or in a document, or
- open `/explore/<slug>?mode=story`.

The screen has three parts:

| Part | Content |
|---|---|
| **Chronicle** (left) | The topics of the library, your earlier questions, and **New session** |
| Middle | A **topic overview** generated from the library's documents, the questions suggested for each topic, and the conversation |
| **Evidence** (right) | The documents an answer cites |

## Set your perspective

The first time you open story mode, a dialog asks **How should answers be formulated for you?** You can reopen it at any time with **Adjust perspective**.

| Setting | Choices |
|---|---|
| **Language** | The language of the answers |
| **Thematic Interests** | Up to five, for example technology, society and culture, ecology and sustainability, education and learning |
| **Access Perspective** | Up to five, for example insight-oriented, practice-oriented, future-oriented |
| **Language Style** | One of scientific, generally understandable, youth-oriented, professional, child-friendly, simple language and others |
| **Advanced Settings** | The language model |

The perspective changes how an answer is worded and what it emphasises. It does not change which documents are available.

## Ask a question

1. Pick one of the suggested questions of a topic, or open the question box with the round button at the bottom right and type your own.
2. Choose the **Answer length**: Short, Medium, Detailed or Unlimited.
3. Send the question. While the answer is written, the steps are shown in plain words.

Each answer comes with:

- **Citation numbers** in the text. One number stands for one document. Click a number to jump to that document in the evidence column.
- **Evidence cards** that show how many passages of the document were used and, where known, the page.
- **Other documents found**: documents that matched the question but were not cited.
- **Follow-up questions** that you can ask with one click.

Next to your question you find **Ask again** and **Delete question**.

## Limit a question with filters

Filters you set in the gallery stay active in story mode. A question then searches only the documents that match them. The active filters are shown as chips next to the document counts.

## How an answer is found

The question is compared by meaning, not by keywords, with the passages of all documents. The passages that fit best are given to the language model together with your question, your perspective and the rules of the library. The model writes the answer from these passages and marks which document each statement comes from.

Answers are stored. When the same question is asked again under the same conditions, the stored answer is shown.

## For library owners: shape the answers

| Where | What you set |
|---|---|
| **Settings → Story → Antwortregeln** (answer rules) | Instructions every answer must follow, written as text. They can refer to the values of a metadata field, for example the status of a measure, so that something rejected is not described as decided. |
| **Settings → Story → Benannte Regelsätze** (named rule sets) | Alternative sets of rules. A story section on the website selects one with `rules=`. |
| **Settings → Erweitert → Suche & KI** (search and models) | The meaning of each value of a metadata field, and the models used |
| **Settings → Öffentlicher Auftritt** | What a document is called, for example "5 talks cited" |

After an answer is written, it is checked against the metadata of the cited documents. The result is added as a note below the answer; the text of the answer is not changed.

## For library owners: review stored answers

**Settings → Fragen & Antworten** (questions and answers) lists every stored question with its date, language, model, number of sources and state:

| State | Meaning |
|---|---|
| **aktuell** (current) | The answer matches the present rules and documents |
| **veraltet** (outdated) | The rules, the metadata values or the number of documents have changed since the answer was written |
| **verworfen** (discarded) | You have discarded the answer; the question will be answered afresh next time |

**Verwerfen** discards one answer, **Alle Antworten verwerfen** all of them. Nothing is deleted; discarded answers stay in the log.

## Who can ask

- In a public library, anyone can ask without an account.
- Drafts are used only for owners and moderators. Visitors and signed-in people who are not members get answers from published documents only.

## Next

- [Operate a library with an AI agent](operate-with-an-agent.md) – ask questions and measure answers with a fixed set of test questions
