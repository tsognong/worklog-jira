import { requestJira } from "@forge/bridge";
import * as XLSX from 'xlsx';
/**
 * @typedef {Object} GadgetConfig
 * @property {string} fromDate - Start date in YYYY-MM-DD format.
 * @property {string} toDate - End date in YYYY-MM-DD format.
 * @property {string[]} projects - Selected project IDs.
 * @property {string[]} components - Selected component IDs.
 * @property {string[]} authors - Selected author IDs.
 */





export const buildJqlQuery = (gadgetConfiguration) => {
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

export const convertToCSV = (columns, rows) => {
    const header = columns.map(col => col.content).join(',');
    const data = rows.map(row =>
        row.cells.map(cell => cell.content).join(',')
    ).join('\n');
    return `${header}\n${data}`;
};

export const downloadCSV = (csv, filename) => {
    const csvFile = new Blob([csv], { type: 'text/csv' });
    const downloadLink = document.createElement('a');
    downloadLink.download = filename;
    downloadLink.href = window.URL.createObjectURL(csvFile);
    downloadLink.style.display = 'none';
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
};

export const handleExportCSV = (columns, rows, filename) => {
    const csvData = convertToCSV(columns, rows);
    downloadCSV(csvData, filename);
};

export const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString()
    .split("T")[0];

export const lastDay = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)
    .toISOString()
    .split("T")[0];

export const convertToExcel = (columns, rows) => {
    const header = columns.map(col => col.content);
    const data = rows.map(row =>
        row.cells.map(cell => cell.content)
    );

    // Create a new workbook
    const workbook = XLSX.utils.book_new();

    // Create a worksheet
    const worksheet = XLSX.utils.aoa_to_sheet([header, ...data]);

    // Add the worksheet to the workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Worklog details');

    // Generate the Excel binary data
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });

    return excelBuffer;
};

/**
 * Converts data to an Excel workbook with one or more sheets.
 * The arguments should follow a repeating pattern of:
 * - columns: An array of column definition objects (e.g., `{ content: 'Header' }`).
 * - rows: An array of row data objects (e.g., `{ cells: [{ content: 'Data' }] }`).
 * - sheetName: A string representing the name of the worksheet.
 *
 * Example Usage:
 *
 * // For a single sheet:
 * const columns1 = [{ content: 'ID' }, { content: 'Name' }];
 * const rows1 = [{ cells: [{ content: 1 }, { content: 'Alice' }] }, { cells: [{ content: 2 }, { content: 'Bob' }] }];
 * const excelData1 = convertToExcel(columns1, rows1, 'Users');
 *
 * // For multiple sheets:
 * const columns2 = [{ content: 'Product' }, { content: 'Price' }];
 * const rows2 = [{ cells: [{ content: 'Laptop' }, { content: 1200 }] }, { cells: [{ content: 'Mouse' }, { content: 25 }] }];
 * const excelDataMultiple = convertToExcel(
 * columns1, rows1, 'Users',
 * columns2, rows2, 'Products'
 * );
 *
 * @param {...(Array<Object>|string)} args - A sequence of arguments following the
 * (columns array, rows array, sheet name) pattern.
 * @returns {Array<Array<number>>} An array containing the Excel binary data for the entire workbook.
 */
export const converManytToExcel = (...args) => {
    const workbook = XLSX.utils.book_new();
    const excelBuffer = [];

    for (let i = 0; i < args.length; i += 3) {
        const columns = args[i];
        const rows = args[i + 1];
        const sheetName = args[i + 2];

        if (columns && rows && sheetName) {
            const header = columns.map(col => col.content);
            const data = rows.map(row =>
                row.cells.map(cell => {
                    const value = cell.content;
                    if (value === '-') {
                        return ''; // Transform "-" to an empty string for an empty cell
                    }
                    if (!isNaN(parseFloat(value)) && isFinite(value)) {
                        return parseFloat(value);
                    }
                    return value;
                })
            );

            const worksheet = XLSX.utils.aoa_to_sheet([header, ...data]);
            XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
        }
    }

    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    excelBuffer.push(buffer);

    return excelBuffer;
};

export const downloadExcel = (buffer, filename) => {
    const data = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8' });
    const url = window.URL.createObjectURL(data);
    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = `${filename}.xlsx`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    window.URL.revokeObjectURL(url);
};

export const handleExportExcel = (columns, rows, filename) => {
    const excelData = convertToExcel(columns, rows);
    downloadExcel(excelData, filename);
};


/**
 * Triggers the download of an Excel file generated from multiple sheets of data.
 * It uses the `converManytToExcel` function to create the Excel data and then
 * initiates the download with the specified filename.
 *
 * @param {string} filename The desired name for the downloaded Excel file
 * (e.g., 'multiple_sheets.xlsx').
 * @param {...(Array<Object>|string)} args - A sequence of arguments passed directly
 * to the `converManytToExcel` function, following the pattern:
 * (columns array, rows array, sheet name) for each sheet.
 *
 * Example Usage:
 *
 * const columns1 = [{ content: 'ID' }, { content: 'Name' }];
 * const rows1 = [{ cells: [{ content: 1 }, { content: 'Alice' }] }, { cells: [{ content: 2 }, { content: 'Bob' }] }];
 * const columns2 = [{ content: 'Product' }, { content: 'Price' }];
 * const rows2 = [{ cells: [{ content: 'Laptop' }, { content: 1200 }] }, { cells: [{ content: 'Mouse' }, { content: 25 }] }];
 *
 * handleExportManyExcel('combined_data.xlsx',
 * columns1, rows1, 'Users',
 * columns2, rows2, 'Products'
 * );
 */
export const handleExportManyExcel = (filename, ...args) => {
    const excelData = converManytToExcel(...args);
    downloadExcel(excelData[0], filename);
};