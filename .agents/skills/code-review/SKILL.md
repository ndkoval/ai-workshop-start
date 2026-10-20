---
name: code-review
description: Review a pull request for concrete defects and leave concise, reproducible inline comments.
---

# Code review

Review the pull request briefly in its web diff. Inspect enough surrounding code to verify each finding.

- Leave one inline comment per concrete defect on the smallest relevant changed line.
- State where it occurs and the minimal verified steps or command that reproduce it, including expected versus actual behavior.
- Include the impact and the smallest useful fix direction.
- Skip summaries, praise, style nits, and speculative concerns. If there are no findings, say so without adding inline comments.
