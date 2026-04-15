# Todo

- [ ] compound rhyme extrapolation — break multi-syllable words into syllables, find rhymes for each syllable, pair them into two-word rhymes (see sidewalk examples in browser localStorage under manualRhymes)
- [ ] Deduplicate word data fetching — `onWordChange` and `onDisplayedWordChange` both call `prefetchWordData` for the same word on every navigation, doubling API calls and error logs
- [ ] Remove `[showDefinition]` diagnostic console.log from `ui.js` once tooltip behavior is confirmed stable
