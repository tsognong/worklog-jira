import React, { useEffect, useState } from "react";
import {
  Textfield,
  Form,
  Button,
  FormSection,
  FormFooter,
  Label,
  useForm,
  Select,
} from "@forge/react";
import { view, requestJira } from "@forge/bridge";

/** @type {GadgetConfig} */
const defaultConfig = {
  fromDate: "",
  toDate: "",
  projects: [],
  components: [],
  authors: [],
};

export const Edit = () => {
  const { handleSubmit, register, getValues } = useForm({defaultValues: defaultConfig});
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
    view.submit({ ...simplifiedData});
  };


  return (
    <Form onSubmit={handleSubmit(configureGadget)}>
      <FormSection>
        <Label>Date Range (From)</Label>
        <Textfield type="date" {...register("fromDate")} />

        <Label>Date Range (To)</Label>
        <Textfield type="date" {...register("toDate")} />

        <Label>Projects</Label>
        <Select
          appearance="default"
          options={projects}
          isMulti
          placeholder="Select projects"
          {...register("projects")}
        />

        <Label>Components</Label>
        <Select
          appearance="default"
          options={components}
          isMulti
          placeholder="Select components"
          {...register("components")}
        />

        <Label>Authors (Worklog)</Label>
        <Select
          appearance="default"
          options={authors}
          isMulti
          placeholder="Select authors"
          {...register("authors")}
        />
      </FormSection>

      <FormFooter>
        <Button appearance="primary" type="submit">
          Submit
        </Button>
      </FormFooter>
    </Form>
  );
};
