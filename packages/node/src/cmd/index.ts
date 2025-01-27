import { defaultConfig as config } from "../arfleet/config.js";
import * as nodepath from "path";
import axios, { AxiosError } from "axios";

interface ApiResponse {
  data: unknown;
}

export const client_store = async (path: string): Promise<void> => {
  const API_URL = `http://${config.client.apiServer.host}:${config.client.apiServer.port}`;

  try {
    const fullpath = nodepath.resolve(path);
    const response = await axios.post<ApiResponse>(API_URL + "/store", {
      path: fullpath,
    });

    console.log(response.data);
  } catch (err: unknown) {
    if (err instanceof AxiosError) {
      console.error("Error connecting to the API:", err.message);
    } else if (err instanceof Error) {
      console.error("An unexpected error occurred:", err.message);
    } else {
      console.error("An unknown error occurred");
    }
    process.exit(1);
  }
};
