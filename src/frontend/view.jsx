import React from "react";
import {
  useProductContext,
  DynamicTable,
  Text,
  Inline,
  Stack,
  Lozenge,
  Button
} from "@forge/react";
import { requestJira } from '@forge/bridge';
import { buildJqlQuery, handleExportCSV } from "./utils";

/** @type {GadgetConfig} */
export const View = () => {
  const context = useProductContext();
  const [worklogs, setWorklogs] = React.useState(null);


  if (!context) {
    return "Loading...";
  }

  const { gadgetConfiguration } = context.extension

  const decodeHtmlEntities = (text) => {
    const parser = new DOMParser();
    const decoded = parser.parseFromString(text, "text/html").body.textContent;
    return decoded;
  };

  const fetchWorklogs = async () => {
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


  if (worklogs == null) {
    fetchWorklogs().then(setWorklogs);
    return <Text>Loading the data...</Text>;
  }

  const worklogArray = worklogs ?? [];
  const uniqueDates = [...new Set(worklogArray.map((log) => log.date))].sort();

  // Aggregate worklogs by author and component
  const aggregatedData = Object.values(
    worklogArray.reduce((acc, log) => {
      const key = `${log.author}-${log.component}`;

      if (!acc[key]) {
        acc[key] = {
          author: log.author,
          component: log.component,
          dates: uniqueDates.reduce((datesAcc, date) => ({ ...datesAcc, [date]: "-" }), {}),
        };
      }

      acc[key].dates[log.date] = (parseFloat(acc[key].dates[log.date]) || 0) + log.hours;
      return acc;
    }, {})
  );

  // Group components by author
  const groupedData = Object.values(
    aggregatedData.reduce((acc, item) => {
      if (!acc[item.author]) {
        acc[item.author] = {
          author: item.author,
          components: [],
        };
      }
      acc[item.author].components.push({
        component: item.component,
        dates: item.dates,
      });
      return acc;
    }, {})
  );

  // Create table columns
  const columns = [
    {
      key: "author",
      content: "Author",
      isSortable: true,
      shouldTruncate: false,
      width: 20,
      style: {
        whiteSpace: "nowrap",
        overflow: "visible",
        minWidth: "100px",
        maxWidth: "none",
        border: "1px solid #ddd",
        padding: "8px",
      },
    },
    {
      key: "component",
      content: "Component",
      isSortable: true,
      shouldTruncate: false,
      style: {
        whiteSpace: "nowrap",
        overflow: "visible",
        minWidth: "100px",
        maxWidth: "none",
        border: "1px solid #ddd",
        padding: "8px",
        textAlign: "left",
      },
    },
    ...uniqueDates.map((date) => ({
      key: date,
      content: date,
      width: 50,
      isSortable: true,
      shouldTruncate: false,
      style: {
        whiteSpace: "nowrap",
        overflow: "visible",
        minWidth: "100px",
        maxWidth: "none",
        border: "1px solid #ddd",
        padding: "8px",
        textAlign: "left",
      },
    })),
  ];

  // Create table rows, ordered by author
  const rows = groupedData
    .flatMap((authorData) => {
      return authorData.components.map((componentData) => {
        return {
          key: `${authorData.author}-${componentData.component}`,
          cells: [
            {
              key: "author",
              content: authorData.author, // Always show author
              style: {
                whiteSpace: "nowrap",
                overflow: "visible",
                border: "1px solid #ddd",
                padding: "8px",
              },
            },
            {
              key: "component",
              content: componentData.component,
              style: {
                whiteSpace: "nowrap",
                overflow: "visible",
                border: "1px solid #ddd",
                padding: "8px",
                textAlign: "left",
              },
            },
            ...uniqueDates.map((date) => ({
              key: date,
              content:
                componentData.dates[date] === "-"
                  ? "-"
                  : Math.abs(componentData.dates[date]) < 0.0001
                    ? ""
                    : componentData.dates[date].toFixed(2),
              style: {
                whiteSpace: "nowrap",
                overflow: "visible",
                border: "1px solid #ddd",
                padding: "8px",
                textAlign: "left",
              },
            })),
          ],
        };
      });
    })
    .sort((a, b) => a.cells[0].content.localeCompare(b.cells[0].content));

  const transformWorklogData = (worklogArray) => {
    // Aggregate hours by author and component (in days)
    const aggregatedHours = worklogArray.reduce((acc, log) => {
      const authorKey = log.author;
      const componentKey = log.component;

      acc[authorKey] ??= {};
      acc[authorKey][componentKey] ??= 0;
      acc[authorKey][componentKey] += log.hours / 8; // Convert hours to days

      return acc;
    }, {});

    // Extract unique components for headers
    const uniqueComponents = new Set(worklogArray.map((log) => log.component));
    const components = Array.from(uniqueComponents);

    // Create table headers
    const totalColumns = [
      { key: "author", content: "Author", isSortable: true, style: { backgroundColor: '#f2f2f2', textAlign: 'left', padding: '8px', border: '1px solid #ddd' } },
      ...components.map((c) => ({ key: c, content: c, isSortable: true, style: { minWidth: '100px', maxWidth: '200px', whiteSpace: 'normal', backgroundColor: '#f2f2f2', textAlign: 'left', padding: '8px', border: '1px solid #ddd' } })),
      { key: "total", content: "Total Days", isSortable: true, style: { backgroundColor: '#f2f2f2', textAlign: 'left', padding: '8px', border: '1px solid #ddd' } }
    ];

    // Create table rows
    const totalRows = Object.entries(aggregatedHours).map(([author, componentsData]) => {
      const row = { key: author, cells: [{ key: "author", content: author, style: { padding: '8px', border: '1px solid #ddd', whiteSpace: 'nowrap' } }] };
      let authorTotal = 0;

      components.forEach((component) => {
        const days = componentsData[component] || 0;
        row.cells.push({ key: component, content: days === 0 ? "-" : days.toFixed(2), style: { padding: '8px', border: '1px solid #ddd', whiteSpace: 'nowrap' } });
        authorTotal += days;
      });

      row.cells.push({ key: "total", content: authorTotal === 0 ? "-" : authorTotal.toFixed(2), style: { padding: '8px', border: '1px solid #ddd', whiteSpace: 'nowrap' } });
      return row;
    });

    // Calculate component totals
    const componentTotals = components.map((component) => {
      let total = 0;
      Object.values(aggregatedHours).forEach((componentsData) => {
        total += componentsData[component] || 0;
      });
      return total === 0 ? "-" : total.toFixed(2);
    });

    // Create total row for components
    const grandTotal = componentTotals.reduce((sum, total) => (total === "-" ? sum : sum + parseFloat(total)), 0);
    const totalRow = {
      key: "grand-total",
      cells: [
        { key: "author", content: "Total", style: { padding: '8px', border: '1px solid #ddd', fontWeight: 'bold' } },
        ...componentTotals.map((total) => ({ key: "component-total", content: total, style: { padding: '8px', border: '1px solid #ddd', fontWeight: 'bold' } })),
        { key: "grand-total", content: grandTotal === 0 ? "-" : grandTotal.toFixed(2), style: { padding: '8px', border: '1px solid #ddd', fontWeight: 'bold' } }
      ]
    };

    totalRows.push(totalRow);

    return { totalColumns, totalRows };
  };

  const { totalColumns, totalRows } = transformWorklogData(worklogArray);

  return (
    <>
      {worklogs == null ? (
        <Text>Loading the data...</Text>
      ) : (
        <>
          <Inline space="space.200">
            <Stack space='space.100' alignInline='start'>
              <Lozenge>From Date</Lozenge>
              <Lozenge isBold>{gadgetConfiguration.fromDate}</Lozenge>
            </Stack>
            <Stack space='space.100' alignInline='start'>
              <Lozenge>To Date</Lozenge>
              <Lozenge isBold>{gadgetConfiguration.toDate}</Lozenge>
            </Stack>
            <Stack space='space.100' alignInline='start'>
              <Lozenge>Projects</Lozenge>
              <Lozenge isBold>{gadgetConfiguration.projects?.map(p => p.label).join(', ') || 'All'}</Lozenge>
            </Stack>
            <Stack space='space.100' alignInline='start'>
              <Lozenge>Components</Lozenge>
              <Lozenge isBold>{gadgetConfiguration.components?.map(c => c.label).join(', ') || 'All'}</Lozenge>
            </Stack>
            <Stack space='space.100' alignInline='start'>
              <Lozenge>Authors</Lozenge>
              <Lozenge isBold>{gadgetConfiguration.authors?.map(a => decodeHtmlEntities(a.label)).join(', ') || 'All'}</Lozenge>
            </Stack>
            <Button
              onClick={() => handleExportCSV(columns, rows, 'worklog_data.csv')}
              appearance="primary"
            >
              Export to CSV
            </Button>
            <Button
              onClick={() => handleExportCSV(totalColumns, totalRows, 'worklog_summary_data.csv')}
              appearance="default"
            >
              Export summary to CSV
            </Button>
          </Inline>
          <DynamicTable head={{ cells: columns }} rows={rows} caption={"Worklog details (hours)"} className="worklog-table" />
          <DynamicTable head={{ cells: totalColumns }} rows={totalRows} caption={"Worklog Summary by Project"} />
        </>
      )}
    </>
  );

};