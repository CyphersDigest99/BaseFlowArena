import datetime

def prompt(section, multiline=False):
    print(f"\n{section}:")
    if multiline:
        print("(Enter multiple lines. End with a single '.')")
        lines = []
        while True:
            line = input()
            if line.strip() == '.':
                break
            lines.append(line)
        return '\n'.join(lines)
    else:
        return input("> ")

now = datetime.datetime.now().strftime("%Y-%m-%d")

summary = f"""# Branch Summary

## Branch Name
{prompt('Branch Name')}

## Goal / Purpose
{prompt('Goal / Purpose', multiline=True)}

## Key Features / Changes
{prompt('Key Features / Changes (one per line, end with .)', multiline=True)}

## Files Created / Modified
{prompt('Files Created / Modified (one per line, end with .)', multiline=True)}

## Testing & Validation
{prompt('Testing & Validation', multiline=True)}

## Known Issues / Follow-ups
{prompt('Known Issues / Follow-ups', multiline=True)}

## Next Steps
{prompt('Next Steps', multiline=True)}

## Reference
- **Date Closed:** {now}
- **Related PR/Issue:** {prompt('Related PR/Issue')}
- **Summary Author:** {prompt('Summary Author')}
"""

with open("BRANCH_SUMMARY.md", "w", encoding="utf-8") as f:
    f.write(summary)

print("\nBranch summary saved to BRANCH_SUMMARY.md")