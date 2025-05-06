import React, { useEffect, useMemo, useState } from "react";
import {
  DynamicTable,
  Inline,
  Button,
  Spinner,
  Box,
  EmptyState,
  Link
} from "@forge/react";
import { requestJira } from '@forge/bridge';
import { buildJqlQuery, handleExportCSV, handleExportExcel, handleExportManyExcel } from "./utils";
import { view } from "@forge/bridge";



export const PivotTable = ({ filters }) => {

  const [params, setParams] = useState(filters);
  const [worklogs, setWorklogs] = React.useState([]);
  const [loading, setLoading] = useState(false);
  const [jiraBaseUrl, setJiraBaseUrl] = useState("");


  const getSiteUrl = async () => {
    const context = await view.getContext();
    return context?.siteUrl;
  }
  useEffect(() => {
    getSiteUrl().then(setJiraBaseUrl);
  }, []);


  useEffect(() => {
    setParams(filters);
  }, [filters]);

  const fetchWorklogs = async (params) => {
    setLoading(true);
    try {
      const jqlQuery = buildJqlQuery(params);
      const fromDate = params.fromDate;
      const toDate = params.toDate;
      const authors = params.authors?.map(author => author.label) || [];

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

          //jira does not include all worklogs in the issues search query
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

        const isInDateRange = logDate >= start && logDate <= end;
        const isAuthorIncluded = authors.length === 0 || authors.includes(log.author);

        return isInDateRange && isAuthorIncluded;
      });

      return filteredWorklogs;
    } catch (error) {
      console.error("Error fetching worklogs:", error);
      return [];
    } finally {
      setLoading(false);
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

  useEffect(() => {
    fetchWorklogs(params).then(setWorklogs);
  }, [params]);


  const uniqueDates = useMemo(() =>
    [...new Set(worklogs.map((log) => log.date))].sort(),
    [worklogs]
  );

  // Aggregate worklogs by author and component
  const aggregatedData = useMemo(() => Object.values(
    worklogs.reduce((acc, log) => {
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
  ), [worklogs, uniqueDates]);

  // Group components by author
  const groupedData = useMemo(() => Object.values(
    aggregatedData.reduce((acc, item) => {
      if (!acc[item.author]) {
        acc[item.author] = { author: item.author, components: [] };
      }
      acc[item.author].components.push({ component: item.component, dates: item.dates });
      return acc;
    }, {})
  ), [aggregatedData]);

  // Create table columns
  const columns = useMemo(() => [
    {
      key: "author",
      content: "Author",
      isSortable: true,
      shouldTruncate: false,
      width: 20,
      style: { whiteSpace: "nowrap", overflow: "visible", minWidth: "100px", border: "1px solid #ddd", padding: "8px" },
    },
    {
      key: "component",
      content: "Component",
      isSortable: true,
      shouldTruncate: false,
      style: { whiteSpace: "nowrap", overflow: "visible", minWidth: "100px", border: "1px solid #ddd", padding: "8px", textAlign: "left" },
    },
    ...uniqueDates.map((date) => ({
      key: date,
      content: date,
      width: 50,
      isSortable: true,
      shouldTruncate: false,
      style: { whiteSpace: "nowrap", overflow: "visible", minWidth: "100px", border: "1px solid #ddd", padding: "8px", textAlign: "left" },
    })),
  ], [uniqueDates]);

  // Create table rows, ordered by author
  const rows = useMemo(() => groupedData
    .flatMap((authorData) => authorData.components.map((componentData) => ({
      key: `${authorData.author}-${componentData.component}`,
      cells: [
        { key: "author", content: authorData.author, style: { whiteSpace: "nowrap", border: "1px solid #ddd", padding: "8px" } },
        { key: "component", content: componentData.component, style: { whiteSpace: "nowrap", border: "1px solid #ddd", padding: "8px", textAlign: "left" } },
        ...uniqueDates.map((date) => ({
          key: date,
          content: componentData.dates[date] === "-" ? "-" :
            (Math.abs(componentData.dates[date]) < 0.0001 ? "" :
              // Dynamically get the base URL from the browser's location
              <Link
                href={`${jiraBaseUrl}/issues/?jql=worklogAuthor="${encodeURIComponent(authorData.author)}" AND worklogDate="${encodeURIComponent(date)}" AND component="${encodeURIComponent(componentData.component)}" ORDER BY created ASC`}
                openNewTab={true}
              >
                {componentData.dates[date].toFixed(2)}
              </Link>
            ),
          //content: componentData.dates[date] === "-" ? "-" : (Math.abs(componentData.dates[date]) < 0.0001 ? "" : componentData.dates[date].toFixed(2)),
          style: { whiteSpace: "nowrap", border: "1px solid #ddd", padding: "8px", textAlign: "left" },
        })),
      ],
    })))
    .sort((a, b) => a.cells[0].content.localeCompare(b.cells[0].content)),
    [uniqueDates, groupedData]);

  const rowsCsvData = useMemo(() => groupedData
    .flatMap((authorData) => authorData.components.map((componentData) => ({
      key: `${authorData.author}-${componentData.component}`,
      cells: [
        { key: "author", content: authorData.author, style: { whiteSpace: "nowrap", border: "1px solid #ddd", padding: "8px" } },
        { key: "component", content: componentData.component, style: { whiteSpace: "nowrap", border: "1px solid #ddd", padding: "8px", textAlign: "left" } },
        ...uniqueDates.map((date) => ({
          key: date,
          content: componentData.dates[date] === "-" ? "-" :
            (Math.abs(componentData.dates[date]) < 0.0001 ? "" :
              componentData.dates[date].toFixed(2)
            ),
          //content: componentData.dates[date] === "-" ? "-" : (Math.abs(componentData.dates[date]) < 0.0001 ? "" : componentData.dates[date].toFixed(2)),
          style: { whiteSpace: "nowrap", border: "1px solid #ddd", padding: "8px", textAlign: "left" },
        })),
      ],
    })))
    .sort((a, b) => a.cells[0].content.localeCompare(b.cells[0].content)),
    [uniqueDates, groupedData]);

  const transformWorklogData = useMemo(() => {
    return (worklogs) => {
      const aggregatedHours = worklogs.reduce((acc, log) => {
        acc[log.author] ??= {};
        acc[log.author][log.component] ??= 0;
        acc[log.author][log.component] += log.hours / 8; // Convert hours to days
        return acc;
      }, {});

      const uniqueComponents = new Set(worklogs.map((log) => log.component));
      const components = Array.from(uniqueComponents);

      const totalColumns = [
        { key: "author", content: "Author", isSortable: true, style: { padding: '8px', border: '1px solid #ddd' } },
        ...components.map((c) => ({ key: c, content: c, isSortable: true, style: { minWidth: '100px', maxWidth: '200px', whiteSpace: 'normal', textAlign: 'left', padding: '8px', border: '1px solid #ddd' } })),
        { key: "total", content: "Total Days", isSortable: true, style: { textAlign: 'left', padding: '8px', border: '1px solid #ddd' } }
      ];

      const totalRows = Object.entries(aggregatedHours).map(([author, componentsData]) => {
        let authorTotal = 0;
        const row = { key: author, cells: [{ key: "author", content: author, style: { padding: '8px', border: '1px solid #ddd' } }] };

        components.forEach((component) => {
          const days = componentsData[component] || 0;
          row.cells.push({ key: component, content: days === 0 ? "-" : days.toFixed(2), style: { padding: '8px', border: '1px solid #ddd' } });
          authorTotal += days;
        });

        row.cells.push({ key: "total", content: authorTotal === 0 ? "-" : authorTotal.toFixed(2), style: { padding: '8px', border: '1px solid #ddd' } });
        return row;
      });

      const componentTotals = components.map((component) => {
        let total = 0;
        Object.values(aggregatedHours).forEach((componentsData) => { total += componentsData[component] || 0; });
        return total === 0 ? "-" : total.toFixed(2);
      });

      const grandTotal = componentTotals.reduce((sum, total) => (total === "-" ? sum : sum + parseFloat(total)), 0);
      totalRows.push({
        key: "grand-total",
        cells: [
          { key: "author", content: "Total", style: { padding: '8px', border: '1px solid #ddd', fontWeight: 'bold' } },
          ...componentTotals.map((total) => ({ key: "component-total", content: total, style: { padding: '8px', border: '1px solid #ddd', fontWeight: 'bold' } })),
          { key: "grand-total", content: grandTotal === 0 ? "-" : grandTotal.toFixed(2), style: { padding: '8px', border: '1px solid #ddd', fontWeight: 'bold' } }
        ]
      });

      return { totalColumns, totalRows };
    };
  }, [worklogs]);

  const { totalColumns, totalRows } = transformWorklogData(worklogs);

  return (
    <>
      {loading ? (
        <Spinner size="medium" />
      ) : (
        <>

          {worklogs.length > 0 ?
            <Box>
              <Inline space="space.100">
                <Button
                  onClick={() => handleExportCSV(columns, rowsCsvData, 'worklog_data.csv')}
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

                <Button
                  onClick={() => handleExportManyExcel('worklog_data', columns, rowsCsvData, 'worklog per day', totalColumns, totalRows, 'worklog summary' )}
                  appearance="primary"
                >
                  Export to Excel
                </Button>
              </Inline>
              <DynamicTable head={{ cells: columns }} rows={rows} caption={"Worklog details (hours)"} className="worklog-table" />
              <DynamicTable key={worklogs.length}
                head={{ cells: totalColumns }} rows={totalRows} caption={"Worklog Summary by Project"} />
            </Box>
            :
            <EmptyState
              header="No data found"
              description="Use the filters above to search for worklog information."
            />
          }
        </>
      )}
    </>
  );

};