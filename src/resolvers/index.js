import Resolver from '@forge/resolver';
import { requestJira } from '@forge/bridge';

const resolver = new Resolver();

resolver.define('getText', (req) => {
  console.log(req);
  return 'Hello, world!';
});

const getAllWorklogsForIssue = async (issueKey, fromDate, toDate, project, component) => {
  try {
    let startAt = 0;
    let allWorklogs = [];
    let hasMore = true;

    const fromDateTimestamp = new Date(fromDate + "T00:00:00.000Z").getTime();
    const toDateTimestamp = new Date(toDate + "T23:59:59.999Z").getTime();

    while (hasMore) {
      const res = await requestJira(
        `/rest/api/3/issue/${issueKey}/worklog?startedAfter>=${fromDateTimestamp}&startedBefore<=${toDateTimestamp}&startAt=${startAt}&maxResults=50`
      );
      const data = await res.json();
      allWorklogs = allWorklogs.concat(data.worklogs.map((log) => ({
        date: log.started.split("T")[0],
        author: log.author.displayName,
        hours: log.timeSpentSeconds / 3600,
        started: log.started,
        project: project,
        component: component,
      })));

      if (data.total <= startAt + 50) {
        hasMore = false;
      } else {
        startAt += 50;
      }
    }

    return allWorklogs;
  } catch (error) {
    console.error(`Error retrieving additional worklogs for issue ${issueKey}:`, error);
    return [];
  }
};

const fetchWorklogs = async (gadgetConfiguration) => {
  try {
    const jqlQuery = buildJqlQuery(gadgetConfiguration);
    const fromDate = gadgetConfiguration.fromDate;
    const toDate = gadgetConfiguration.toDate;

    let startAt = 0;
    let allWorklogs = [];
    let hasMore = true;

    while (hasMore) {
      const res = await requestJira(
        `/rest/api/3/search?jql=${encodeURIComponent(jqlQuery)}&fields=key,summary,worklog,project,components,worklogAuthor&startAt=${startAt}&maxResults=100`
      );
      const data = await res.json();

      for (const issue of data.issues) {
        let issueWorklogs = [];

        if (issue.fields.worklog.total > 20) {
          issueWorklogs = await getAllWorklogsForIssue(issue.key, fromDate, toDate, issue.fields.project?.name || "Unknown Project", issue.fields.components.length ? issue.fields.components[0].name : "N/A");
        } else {
          issueWorklogs = issue.fields.worklog.worklogs.map((log) => ({
            date: log.started.split("T")[0],
            author: log.author.displayName,
            project: issue.fields.project?.name || "Unknown Project",
            component: issue.fields.components.length ? issue.fields.components[0].name : "N/A",
            hours: log.timeSpentSeconds / 3600,
            started: log.started,
          }));
        }

        allWorklogs = allWorklogs.concat(issueWorklogs);
      }

      if (data.total <= startAt + 100) {
        hasMore = false;
      } else {
        startAt += 100;
      }
    }

    const filteredWorklogs = allWorklogs.filter((log) => {
      const logDate = new Date(log.started);
      const start = new Date(fromDate + "T00:00:00.000Z");
      const end = new Date(toDate + "T23:59:59.999Z");
      return logDate >= start && logDate <= end;
    });

    return filteredWorklogs;
  } catch (error) {
    console.error("Error fetching worklogs:", error);
    return [];
  }
};

resolver.define("getWorklogs", async (req) => {
  const gadgetConfiguration = req.payload.gadgetConfiguration;

  if (!gadgetConfiguration) {
    return { error: "gadgetConfiguration is required" };
  }

  try {
    const worklogs = await fetchWorklogs(gadgetConfiguration);
    return { worklogs };
  } catch (error) {
    console.error("Error in getWorklogs resolver:", error);
    return { error: "Failed to fetch worklogs" };
  }
});

resolver.define('getProjects', async () => {
  try {
    const res = await requestJira(`/rest/api/3/project/search`);
    const data = await res.json();
    const formattedProjects = data.values?.map((project) => ({
      label: project.name,
      value: project.id,
    })) || [];
    return formattedProjects;
  } catch (error) {
    console.error('Error fetching projects:', error);
    return []; // Return an empty array or handle the error appropriately
  }
});

resolver.define('getComponents', async () => {
  try {
    const res = await requestJira(`/rest/api/3/component`);
    const data = await res.json();
    const formattedComponents = data.values?.map((component) => ({
      label: component.name,
      value: component.id,
    })) || [];
    return formattedComponents;
  } catch (error) {
    console.error('Error fetching components:', error);
    return [];
  }
});

resolver.define('getAuthors', async () => {
  try {
    const res = await requestJira(`/rest/api/3/user/search?query=.`);
    const data = await res.json();
    const formattedAuthors = data
      ?.filter((u) => u.accountType === 'atlassian')
      ?.map((user) => ({
        label: user.displayName,
        value: user.accountId,
      })) || [];
    return formattedAuthors;
  } catch (error) {
    console.error('Error fetching authors:', error);
    return [];
  }
});


export const handler = resolver.getDefinitions();