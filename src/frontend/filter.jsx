import React, { useEffect, useState } from "react";
import {
  Textfield,
  Form,
  Button,
  FormSection,
  Label,
  useForm,
  Select,
  Inline,
  Stack,
} from "@forge/react";
import { requestJira } from "@forge/bridge";

const defaultConfig = {
  fromDate: '',
  toDate: '',
  projects: [],
  components: [],
  authors: [],
};

export const FilterForm = ({ onFilterChange }) => {
  const { handleSubmit, register, getValues } = useForm({ defaultValues: defaultConfig });
  const [projects, setProjects] = useState([]);
  const [components, setComponents] = useState([]);
  const [authors, setAuthors] = useState([]);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const res = await requestJira("/rest/api/3/project/search");
        const data = await res.json();
        const formattedProjects = data.values?.map((project) => ({
          label: project.name,
          value: project.id,
        })) || [];
        setProjects(formattedProjects);
      } catch (error) {
        console.error("Error fetching projects:", error);
      }
    };

    const fetchComponents = async () => {
      try {
        const res = await requestJira("/rest/api/3/component");
        const data = await res.json();
        const formattedComponents = data.values?.map((component) => ({
          label: component.name,
          value: component.id,
        })) || [];
        setComponents(formattedComponents);
      } catch (error) {
        console.error("Error fetching components:", error);
      }
    };

    const fetchAuthors = async () => {
      try {
        const res = await requestJira("/rest/api/3/user/search?query=.");
        const data = await res.json();
        const formattedAuthors = data
          ?.filter((u) => u.accountType === "atlassian")
          ?.map((user) => ({
            label: user.displayName,
            value: user.accountId,
          })) || [];
        setAuthors(formattedAuthors);
      } catch (error) {
        console.error("Error fetching authors:", error);
      }
    };

    fetchProjects();
    fetchComponents();
    fetchAuthors();
  }, []);


  const configureGadget = async (data) => {
    const values = getValues();
    const simplifiedData = {
      fromDate: values.fromDate.target.value,
      toDate: values.toDate.target.value,
      components: values.components,
      projects: values.projects,
      authors: values.authors,
    };
    // view.submit({ ...simplifiedData });
    onFilterChange(simplifiedData);
  };


  return (
    <Form onSubmit={handleSubmit(configureGadget)}>

      <FormSection>
        <Inline space="space.200">
          <Stack space='space.50' alignInline='start'>
            <Label>Date Range (From)</Label>
            <Textfield type="date" {...register("fromDate")} />
          </Stack>
          <Stack space='space.50' alignInline='start'>
            <Label>Date Range (To)</Label>
            <Textfield type="date" {...register("toDate")} />
          </Stack>
          <Stack space='space.50' alignInline='start'>
            <Label>Projects</Label>
            <Select
              appearance="default"
              options={projects}
              isMulti
              placeholder="Select projects"
              {...register("projects")}
            />
          </Stack>
          <Stack space='space.50' alignInline='start'>
            <Label>Components</Label>
            <Select
              appearance="default"
              options={components}
              isMulti
              placeholder="Select components"
              {...register("components")}
            />
          </Stack>
          <Stack space='space.50' alignInline='start'>
            <Label>Authors (Worklog)</Label>
            <Select
              appearance="default"
              options={authors}
              isMulti
              placeholder="Select authors"
              {...register("authors")}
            />
          </Stack>
          <Stack space='space.50' alignInline='start'>
            <Label style={{ visibility: 'hidden' }}>Placeholder</Label>
            <Button appearance="primary" type="submit">
              Submit
            </Button>
          </Stack>
        </Inline>
      </FormSection >
    </Form >
  );
};
