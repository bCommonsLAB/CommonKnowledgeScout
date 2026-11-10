# Publish a gallery and a website

## What you achieve

People can browse the documents of your library without signing in, at an address of its own. If you want more than a gallery, the library also gets a website whose pages you write as Markdown files in your storage.

!!! note "Language of the interface"
    Most of the interface is in German. This guide gives the label as it appears on screen, followed by an English translation.

## Before you start

- You own the library.
- At least one file has gone through all three processing steps (see [Transform files into documents](transform-files.md)).

## Open the library to the public

1. Open **Settings → Öffentlicher Auftritt** (public presence).
2. Switch on **Library veröffentlichen** (publish library).
3. Enter the **Web-Adresse (Slug)**: lowercase letters, digits and hyphens. It must be unique on the instance.
4. Fill in **Öffentlicher Name** (public name) and **Öffentliche Beschreibung** (public description).
5. Click **Veröffentlichung speichern** (save).

The library is now available at `/explore/<slug>`. The form shows the link.

Further options on the same page:

| Option | Effect |
|---|---|
| **Zugriff nur für freigegebene Benutzer** (access for approved users only) | Visitors must sign in and be approved |
| **Auf der Startseite anzeigen** (show on the start page) | The library appears as a card on the start page of the instance, with the icon and **Hintergrundbild** (background image) you choose |
| **Sterne-Zahl öffentlich zeigen** (show star counts publicly) | Visitors see how many stars a document has. The names of the people who gave them are never shown. |
| **Galerie-Texte** (gallery texts) | Headline, subtitle, introduction, an explanation of the filters, and the name of the gallery in the menu |
| **Bezeichnung eines Eintrags** (name of an entry) | What a document is called in this library, singular and plural, for example "measure" and "measures" |

## Which documents are visible

A document appears in the gallery once the step **Story publizieren** has run for it. Each document is either *published* or a *draft*. Drafts are hidden from visitors and are not used to answer their questions.

In the gallery, as owner, switch to the table view to see the status of each document and to use **Publish**, **Unpublish** and **Publish all**.

## What visitors see

The gallery has two views, and every visitor can switch between them:

| View | For | What it shows |
|---|---|---|
| **Simple** | People who come to read | Compact cards, filters in a drawer, a short introduction, and a switch between the documents *in focus* and *all* documents |
| **Expert** | People who work with the material | All tools: table and graph views, full filters, story mode |

*In focus* is the ranking by stars that members of the library have given. Under **Settings → Explore** you choose which view opens first and whether the gallery starts in focus or with all entries.

Useful addresses:

| Address | Opens |
|---|---|
| `/explore/<slug>` | The website if there is one, otherwise the gallery |
| `/explore/<slug>?view=gallery` | The gallery |
| `/explore/<slug>?mode=story` | Story mode |
| `/explore/<slug>?site=<page>` | A page of the website |

## Add a website

A website is a set of Markdown files in the library. Each file is one page.

1. Create the pages as Markdown files, by convention in the folder `Webseite/Seiten/`.
2. Give each page front matter. The front matter is flat: one level of `snake_case` keys.

    ```yaml
    ---
    detailViewType: website
    title: About
    slug: about
    menu_order: 2
    hero_layout: band
    hero_title: About this project
    ---
    ```

3. Structure the body with sections:

    ```markdown
    <!-- section layout=image-left -->
    ## Why we do this
    Text of the section.
    <!-- /section -->
    ```

4. Process each page like any other file, so that it is published.
5. In **Settings → Öffentlicher Auftritt**, switch on **Website am Slug anzeigen** (show website at the slug) and set the **Website-Logo**.

| Front matter | Purpose |
|---|---|
| `title`, `slug`, `menu_order`, `menu_area` | Name in the menu, address, position, and whether the page is in the main menu, the footer or hidden |
| `hero_layout`, `hero_title`, `hero_subtitle`, `hero_image`, `cta_label`, `cta_url` | The opening area of the page and its button |
| `banner_tag`, `banner_title`, `banner_limit`, `banner_sort` | A row of documents from the gallery on the page |

| Section layout | Content |
|---|---|
| `text-only`, `image-left`, `image-right`, `full-image`, `video` | Text and media |
| `banner` | Documents from the gallery |
| `story` | A question box that answers from the library, with example questions. One per page. |
| `contact-form` | A contact form |

Inside a section, the blocks `<!-- cards -->`, `<!-- stats -->`, `<!-- chips -->` and `<!-- box -->` add tiles, figures, tags and highlighted text.

The complete syntax is in the [website contract](https://github.com/bCommonsLAB/CommonKnowledgeScout/blob/master/docs/contracts/website-landingpage.md) (German). An agent can create, check and publish the pages for you; see [Operate a library with an AI agent](operate-with-an-agent.md).

## Use your own domain

The operator of the instance maps a domain to your library with the setting `PUBLIC_DOMAIN_LIBRARY_MAP`, for example `{"example.org":"my-library"}`. The domain then shows the library's website at `/`, without the navigation of the application. See [Configuration](../operations/configuration.md#application).

## Embed the gallery in another website

The package `@ks/embed` provides the gallery and story mode as a React component:

```tsx
import '@ks/embed/styles.css'
import { KnowledgeScoutExplorer } from '@ks/embed'

<KnowledgeScoutExplorer
  baseUrl="https://your-instance.example"
  library="my-library"
  view="gallery"
  locale="en"
/>
```

The embedded component shows only what is visible without signing in. It has no sign-in of its own, and libraries that require one are not shown. The package is built from this repository; it is not published to a public registry.

## Next

- [Ask questions in story mode](story-mode.md)
