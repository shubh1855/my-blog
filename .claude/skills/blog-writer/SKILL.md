---
name: blog-writer
description: Helps users create new blog posts following astro-koharu blog conventions. Automatically generates correct frontmatter structure, selects appropriate category paths, and provides Markdown content structure suggestions. Use when: write a blog post, create new article, new post, create blog post.
---

# Blog Writer Skill

Helps users create new blog posts following astro-koharu blog conventions.

## Your Task

When the user requests a new blog post:

1. **Gather required information** (if not provided by the user):
   - Article title
   - Article category (choose from the category list below)
   - Article topic/keywords (for generating tags and description)

2. **Generate frontmatter**:
   ```yaml
   ---
   title: [Article title]
   link: [URL slug, use lowercase English with hyphens]
   catalog: true
   date: [Current datetime, format: YYYY-MM-DD HH:mm:ss]
   description: [One-line description of the article, 50-100 characters]
   tags:
     - [Relevant tag 1]
     - [Relevant tag 2]
     - [Relevant tag 3]
   categories:
     - [Primary category, Sub-category]
   ---
   ```

   **Category format notes**:
   - Nested categories use array format: `- [Primary, Sub-category]`
   - Example: `- [Notes, Frontend]` creates URL `/categories/note/front-end` and breadcrumb "Notes → Frontend"
   - Single category uses plain name: `categories: Essays`

3. **Determine file path**:
   - Base path: `src/content/blog/`
   - Generate corresponding subdirectory structure based on category
   - Filename: use the `link` field value + `.md` extension

4. **Generate Markdown content skeleton**:
   - Provide article structure suggestions (introduction, body sections, conclusion)
   - Suggest using infographic diagrams where appropriate
   - Provide code example placeholders (for technical articles)

## Category System

### Primary Categories and Sub-categories

1. **Notes (note/)**
   - Frontend (front-end/)
     - React
     - Vue
     - TypeScript
     - CSS
     - Performance Optimization
   - Backend (back-end/) - if needed, ensure mapping is added to `_config.yml`
   - Other new sub-categories - must first add mapping to `_config.yml`

2. **Tools (tools/)**
   - Development Tools
   - Productivity Tools
   - Usage Guides

3. **Essays (life/)**
   - Life Essays
   - Annual Reviews
   - Reading Notes

4. **Weekly (weekly/)**
   - Tech Weekly
   - Weekly Shares

### Category Mapping Rules

**YAML Format (important)**:
```yaml
# Nested categories (recommended) - use array wrapping
categories:
  - [Notes, Frontend]

# Single category - write category name directly
categories: Essays
```

**URL and path mapping**:
- `categories: Essays` → URL: `/categories/life` → File path: `src/content/blog/life/`
- `categories: - [Notes, Frontend]` → URL: `/categories/note/front-end` → File path: `src/content/blog/note/front-end/`
- `categories: - [Notes, Frontend, CSS]` → URL: `/categories/note/front-end` → File path: `src/content/blog/note/front-end/` (third-level category used as tag)

**Notes**:
- Nested categories must use `- [Primary, Sub-category]` format
- Category names (Chinese) map to URL slugs (English); see mapping in the category list above

### Adding New Categories

If the user needs to create a category not listed above:

1. **Update `_config.yml`**:
   ```yaml
   category_map:
     # Primary categories
     Essays: life
     Notes: note
     Tools: tools
     Weekly: weekly

     # Sub-categories
     Frontend: front-end
     Backend: back-end  # Example addition

     # Add new category mapping
     NewCategoryName: new-category-slug
   ```

2. **Create corresponding directory**:
   - Create the matching directory structure under `src/content/blog/`
   - Example: adding "Backend" category requires creating `src/content/blog/note/back-end/`

3. **Inform the user**:
   - Confirm the new category mapping was added to `_config.yml`
   - State the new category's URL path

## File Naming Conventions

- Use lowercase English letters
- Separate words with hyphens `-`
- Avoid special characters
- Examples: `react-hooks-guide.md`, `astro-blog-setup.md`

## Content Suggestions

### Technical Article Structure

```markdown
## Background / Problem

[Describe the problem to solve or technical background]

## Solution

[Detailed explanation of the solution]

### Key Technical Point 1

[Technical details and code examples]

### Key Technical Point 2

[Technical details and code examples]

## Practical Results

[Real-world application results, performance comparisons, etc.]

## Conclusion

[Summary of key takeaways and lessons learned]
```

### Tool / Guide Article Structure

```markdown
## Introduction

[Brief introduction to the tool/method]

## Installation / Preparation

[Installation steps or prerequisites]

## Basic Usage

[Basic usage and examples]

## Advanced Features

[Advanced functionality and techniques]

## Practical Tips

[Best practices and important notes]

## Conclusion

[Summary and resource links]
```

### Essay Article Structure

```markdown
## Introduction

[Opening, introduce the topic]

## Main Content

[Multiple paragraphs expanding on the discussion]

## Reflections / Conclusion

[Personal thoughts and summary]
```

## Infographic Usage Suggestions

Based on article type, recommended scenarios for infographics:

- **List information** (tech stacks, feature lists) → `list-grid-badge-card`
- **Process steps** (installation steps, dev workflow) → `sequence-zigzag-steps-underline-text`
- **Comparative analysis** (tech comparisons, pros/cons) → `compare-binary-horizontal-simple-fold`
- **Statistical data** (performance comparisons, usage stats) → `chart-column-simple` or `chart-bar-plain-text`
- **Hierarchical structure** (directory structure, knowledge trees) → `hierarchy-tree-tech-style-capsule-item`

## Final Steps

After creating the blog post:

1. **If a new category was added**:
   - Confirm `_config.yml` `category_map` has been updated
   - Confirm the corresponding directory structure was created
   - Inform the user of the new category's URL path

2. **Run checks**:
   - Run `pnpm dev` for local preview
   - Run `pnpm lint:fix` to check formatting

3. **Follow-up suggestions**:
   - Remind the user they can use infographic skills to add diagrams
   - If applicable, suggest related article recommendations (based on tags)

## Example Conversations

### Example 1: Using an existing category

**User**: Write an article about React Hooks best practices

**You should**:

1. Confirm category: Notes > Frontend > React
2. Generate file path: `src/content/blog/note/front-end/react-hooks-best-practices.md`
3. Create file with complete frontmatter (using `- [Notes, Frontend]` category format)
4. Provide article structure skeleton
5. Suggest using `list-grid-badge-card` infographic in the "Common Hooks Comparison" section
6. Suggest using `sequence-zigzag-steps-underline-text` infographic in the "Hooks Usage Flow" section

### Example 2: Needs a new category

**User**: Write an article about Node.js backend development

**You should**:

1. Notice "Backend" category is not in the existing category list
2. Ask the user if they want to add a "Backend" category
3. If the user agrees:
   - Update `_config.yml`, add `Backend: back-end`
   - Create directory `src/content/blog/note/back-end/`
   - Generate article file `src/content/blog/note/back-end/nodejs-development.md`
   - Frontmatter uses `- [Notes, Backend]` category format
4. Inform the user:
   - New category has been added to `_config.yml`
   - URL path is `/categories/note/back-end`
   - Corresponding directory structure has been created
