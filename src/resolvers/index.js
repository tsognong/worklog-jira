import Resolver from '@forge/resolver';
import { requestJira } from '@forge/bridge';

const resolver = new Resolver();

const buildJqlQuery = (gadgetConfiguration) => {
    let jqlQuery = "";

    if (gadgetConfiguration?.projects?.length > 0) {
        const projects = gadgetConfiguration.projects.map(project => `"${project.label}"`).join(',');
        jqlQuery += `project in (${projects})`;
    }

    if (gadgetConfiguration?.components?.length > 0) {
        if (jqlQuery) jqlQuery += " AND ";
        const components = gadgetConfiguration.components.map(component => `"${component.label}"`).join(',');
        jqlQuery += `component in (${components})`;
    }

    if (gadgetConfiguration?.authors?.length > 0) {
        if (jqlQuery) jqlQuery += " AND ";
        const authors = gadgetConfiguration.authors.map(author => `"${author.value}"`).join(',');
        jqlQuery += `worklogAuthor in (${authors})`;
    }

    if (gadgetConfiguration?.fromDate && gadgetConfiguration?.toDate) {
        if (jqlQuery) jqlQuery += " AND ";
        jqlQuery += `worklogDate >= "${gadgetConfiguration.fromDate}" AND worklogDate <= "${gadgetConfiguration.toDate}"`;
    }

    return jqlQuery;
};

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
        `/rest/api/3/issue/${issueKey}/worklog?startedAfter=${fromDateTimestamp}&startedBefore=${toDateTimestamp}&startAt=${startAt}&maxResults=50`
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

    let nextPageToken = null;
    let allWorklogs = [];
    let hasMore = true;

    while (hasMore) {
      const searchBody = {
        jql: jqlQuery,
        maxResults: 100,
        fields: ['key', 'summary', 'worklog', 'project', 'components']
      };
      
      if (nextPageToken) {
        searchBody.nextPageToken = nextPageToken;
      }
      
      const res = await requestJira(`/rest/api/3/search/jql`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(searchBody)
      });
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

      // Use nextPageToken for pagination instead of startAt
      if (data.nextPageToken) {
        nextPageToken = data.nextPageToken;
      } else {
        hasMore = false;
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
    const res = await requestJira(`/rest/api/3/project?expand=description,lead,url&maxResults=1000`);
    const data = await res.json();
    const formattedProjects = data?.map((project) => ({
      label: project.name,
      value: project.id,
    })) || [];
    return formattedProjects;
  } catch (error) {
    console.error('Error fetching projects:', error);
    return []; // Return an empty array or handle the error appropriately
  }
});

resolver.define('getComponents', async (req) => {
  try {
    const projectId = req.payload?.projectId;
    if (!projectId) {
      // If no project specified, return empty array or get components from all projects
      return [];
    }
    
    const res = await requestJira(`/rest/api/3/project/${projectId}/components`);
    const data = await res.json();
    const formattedComponents = data?.map((component) => ({
      label: component.name,
      value: component.id,
    })) || [];
    return formattedComponents;
  } catch (error) {
    console.error('Error fetching components:', error);
    return [];
  }
});

resolver.define('getAuthors', async (req) => {
  try {
    const searchQuery = req.payload?.query || '';
    const maxResults = req.payload?.maxResults || 50;
    
    // Use a more specific search instead of searching all users with "."
    const queryParam = searchQuery ? `query=${encodeURIComponent(searchQuery)}` : 'query=a'; // Search for users with 'a' in their name as a reasonable default
    const res = await requestJira(`/rest/api/3/user/search?${queryParam}&maxResults=${maxResults}`);
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