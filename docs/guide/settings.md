---
title: Settings
---

# Settings

This page summarizes the settings areas of the application and links to relevant sub-pages.

- Library: `/settings`
- Storage: `/settings/storage`
- Owner: `/settings/owner`
- Notifications: `/settings/notifications`
- Display: `/settings/display`
- Public Publishing: `/settings/public` {#public-publishing}

## Public Publishing {#public-publishing}

The Public Publishing settings allow you to make your library publicly accessible and publish content in a gallery.

### Basic Configuration

Open `/settings/public` to configure Public Publishing settings:

#### Basic Settings
- **Slug Name**: Unique URL identifier (e.g., `sfscon-talks`)
  - Used for public URLs
  - Must be unique
  - Only lowercase letters, numbers, and hyphens allowed
  
- **Public Name**: Public display name (e.g., "SFSCon Talks")
  - Displayed in public view
  
- **Description**: Description text for public teasers
  - Displayed in overviews and previews
  
- **Icon**: Icon for public view
  - Lucide icon name or URL to an image
  - Optional

#### Public Availability
- **Is Public**: Enable/disable public availability
  - When enabled, the library can be accessed via public URL
  - Public libraries can be used without sign-in

#### API Key (Optional)
- **OpenAI API Key**: API key for anonymous chat requests
  - Used server-side, never sent to client
  - Enables chat functionality for anonymous users
  - Optional but recommended for full functionality

### Gallery Configuration

The Gallery settings configure the public gallery view:

- **Headline**: Large headline for the Gallery view
- **Subtitle**: Subtitle below the headline
- **Description**: Description text below the headline
- **Filter Description**: Description text for the filter panel

### Story Mode Configuration

The Story Mode settings configure the Story view:

- **Headline**: Headline in Story tab
- **Intro**: Paragraph below the headline
- **Topics Title**: Title for topics overview
- **Topics Intro**: Explanation text for topics overview

### Workflow

1. **Select Library**: Choose the library to be published
2. **Configure Basic Settings**: 
   - Set slug name
   - Enter public name and description
   - Optionally: Select icon
3. **Configure Gallery Texts**: 
   - Enter headline, subtitle, description
   - Filter description for filter panel
4. **Configure Story Mode** (optional):
   - Enter story-specific texts
5. **Enable Public**: 
   - Activate "Is Public"
   - Optionally: Enter API key for chat functionality
6. **Save**: Settings are saved

### Public URLs

After activation, the library is accessible at the following URLs:

- **Gallery**: `/library/gallery?library=<slug-name>`
- **Chat**: `/library/<library-id>/chat` (if API key configured)
- **Story**: `/library/gallery?mode=story&library=<slug-name>`

### Publishing Content

To publish content in the gallery:

1. **Transform Files**: Transform PDFs, audio, video, or images to Markdown
2. **Shadow Twins**: Transformed Markdown files are automatically saved as Shadow Twins
3. **View Gallery**: Open the gallery to see transformed content
4. **Public Access**: If "Is Public" is enabled, content is publicly accessible

### Security

- **API Key**: Never sent to client
- **Authentication**: Public libraries can be used without sign-in
- **Permissions**: Only library owners can change Public Publishing settings

