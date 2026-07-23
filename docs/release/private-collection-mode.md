# Collection release mode

PandaAtlas is a personal collection site and now uses one release policy only. There is no separate strict or public-validation mode.

## Commands

```bash
npm run check:panda-curation
npm run process:panda-media
npm run release:default
```

`release:default` is also available as `release:private` and writes its report to:

```text
.release-gate/private-collection.json
.release-gate/private-collection.md
```

## Remaining safeguards

The collection workflow keeps checks that prevent broken data, unsafe files, and unusable builds:

- required CSV files and exact media headers;
- unique source, panda, event, and media identities;
- valid enum values and ISO dates;
- valid source, panda, parent, and related-panda references;
- a usable asset path or HTTPS URL for processable media;
- local media path containment;
- bounded file size and decoded-pixel limits;
- supported, non-animated image formats;
- immutable media output unless replacement is explicit;
- FastAPI tests, Web lint, TypeScript checks, and production build.

## Removed review gates

The project no longer blocks the collection because of publication-oriented review requirements:

- no minimum number of approved events;
- no mandatory approved photograph per panda;
- no requirement that every panda field be complete or verified;
- no clear-rights requirement for collection media;
- no requirement that an image identity be certain;
- no bilingual alt-text or credit completeness gate;
- no alternate strict validator or media processor;
- no `check:panda-curation:public`, `process:panda-media:public`, or `release:public` command.

Both `approved` and `collection_only` media are processed. Uncertainty, source information, rights notes, credit, and alt text may still be recorded for the owner's reference, but they are not release blockers.

## Smithsonian current pair

Bao Li has one `approved` Commons image. Qing Bao has one `collection_only` Commons image with probable-identity wording. Both are valid collection media and both panda profiles are available to the site.
