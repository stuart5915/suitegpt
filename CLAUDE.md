# SUITE Website - Claude Code Instructions

## Project Overview
This is the SUITE ecosystem website (getsuite.app), hosted on Vercel with auto-deploy on git push.

---

## /publish-article Command

When you receive a `/publish-article` prompt (from the publish daemon or manually), follow these steps:

### Input Format
```
/publish-article

Title: [Article Title]
Tags: [comma, separated, tags]
Destination: learn (or docs, blog)

---

[Article content - plain text or markdown]

---

Content ID for status update: [uuid] (optional, for daemon)
```

### Processing Steps

1. **Generate slug** from title
   - Lowercase, replace spaces with hyphens
   - Example: "How AI Fleet Works" → "how-ai-fleet-works"

2. **Format as HTML**
   - Use the article template style from `/learn/ai-fleet.html`
   - Add proper meta tags for SEO
   - Add Open Graph tags for social sharing

3. **Generate cover image** (if Gemini available)
   - Use Gemini API to generate a cover image
   - Save to `/assets/articles/[slug]-cover.png`
   - If Gemini unavailable, use a gradient placeholder or skip

4. **Create article file**
   - Save to `/learn/[slug].html`
   - Match the style of existing articles

5. **Update articles listing**
   - Add new article card to `/learn/articles.html`
   - Put newest articles at the top

6. **Commit and push**
   ```bash
   git add .
   git commit -m "Add article: [Title]"
   git push
   ```

7. **Report success**
   - Output the published URL: `https://getsuite.app/learn/[slug].html`
   - Output the cover image path (if generated)

---

## Article Template Reference

Use this structure for new articles (based on existing `/learn/ai-fleet.html`):

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>[Title] | SUITE</title>
    <meta name="description" content="[Summary/first paragraph]">

    <!-- Open Graph -->
    <meta property="og:title" content="[Title]">
    <meta property="og:description" content="[Summary]">
    <meta property="og:image" content="https://getsuite.app/assets/articles/[slug]-cover.png">
    <meta property="og:url" content="https://getsuite.app/learn/[slug].html">

    <link rel="icon" type="image/png" href="/assets/suite-logo-new.png">
    <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/suite-styles.css">
    <link rel="stylesheet" href="/nav.css">
    <!-- Article styles -->
</head>
<body>
    <nav id="main-nav"></nav>
    <script src="/nav-component.js"></script>

    <article class="article-container">
        <a href="articles.html" class="back-link">← Back to Articles</a>

        <header class="article-header">
            <div class="article-tags">[Tags as badges]</div>
            <h1>[Title]</h1>
            <p class="article-meta">📅 [Date] · ⏱️ [X] min read</p>
        </header>

        <div class="article-content">
            [Formatted content with proper headings, paragraphs, etc.]
        </div>
    </article>

    <footer class="footer">
        <p>© 2026 SUITE. Anyone Can Build. Everyone Gets Paid.</p>
    </footer>
</body>
</html>
```

---

## Supabase Integration

If a Content ID is provided, update the status in Supabase after publishing:

```javascript
// The daemon handles this, but if manual:
supabase.table('content_queue')
    .update({
        status: 'published',
        published_url: 'https://getsuite.app/learn/[slug].html',
        published_at: new Date().toISOString()
    })
    .eq('id', contentId)
```

---

## File Structure

```
/learn/
  ├── articles.html      ← Article listing page
  ├── ai-fleet.html      ← Existing article
  ├── yield-powered-app.html
  └── [new-articles].html

/assets/articles/        ← Article cover images
  └── [slug]-cover.png

/scripts/
  └── publish-daemon.py  ← Polls Supabase, triggers Claude
```

---

## Testing

To test the publish flow manually:
```
/publish-article

Title: Test Article
Tags: test, demo
Destination: learn

---

This is a test article to verify the publishing pipeline works correctly.

## Section 1
Some content here.

## Section 2
More content here.
```
