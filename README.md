# Jira Worklog Dashboard

A Forge-based custom dashboard plugin for Jira that provides comprehensive worklog visualization and reporting capabilities.

## Overview

This Forge app displays worklog data in a Jira dashboard gadget, allowing teams to track and analyze time logged across projects, employees, and components. The dashboard provides flexible filtering and grouping options to help you gain insights into time tracking data.

## Features

- **Worklog Tables**: View time entries organized in easy-to-read tables
- **Multiple Grouping Options**:
  - By Employee
  - By Project
  - By Component
- **Period Filtering**: Filter worklogs by specific time periods
- **Summary Views**: Get overview of total time logged
- **Detailed Time Logs**: Drill down into individual worklog entries and time logged details
- **Export Capabilities**: Export worklog reports to Excel, CSV, and other formats

## Requirements

See [Set up Forge](https://developer.atlassian.com/platform/forge/set-up-forge/) for instructions to get set up.

## Installation & Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Build and Deploy
Deploy your app to the Forge platform:
```bash
forge deploy
```

### 3. Install to Jira Site
Install the app on your Atlassian/Jira site:
```bash
forge install
```

### 4. Development Mode
Run the app locally with live updates:
```bash
forge tunnel
```

## Development

- **Main App File**: Modify your app by editing the `src/index.jsx` file
- **Deploy Changes**: Use `forge deploy` when you want to persist code changes
- **Install on New Site**: Use `forge install` when you want to install the app on a new site
- **Automatic Updates**: Once installed, the site automatically picks up new changes you deploy without needing to reinstall

## Documentation & Resources

- [Forge Platform Documentation](https://developer.atlassian.com/platform/forge/)
- [Forge Dashboard Gadgets Reference](https://developer.atlassian.com/platform/forge/manifest-reference/#jira-dashboard-gadget)
- [Get Help & Support](https://developer.atlassian.com/platform/forge/get-help/)

## Acknowledgments

This plugin is currently used at **Uni2grow** for worklog tracking and reporting.

## Support

See [Get help](https://developer.atlassian.com/platform/forge/get-help/) for how to get help and provide feedback.
```
