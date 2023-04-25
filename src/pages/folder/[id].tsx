import useSWR from "swr";
import useSWRInfinite from "swr/infinite";
import fetcher, { buildNextKey } from "@utils/swrFetch";
import { ErrorResponse, FilesResponse, TFile } from "@/types/googleapis";
import Breadcrumb from "@/components/Breadcrumb";
import { drive_v3 } from "googleapis";
import { useEffect, useState } from "react";
import MarkdownRender from "@/components/utility/MarkdownRender";
import config from "@config/site.config";
import GridLayout from "@components/layout/Files/GridLayout";
import useLocalStorage from "@hooks/useLocalStorage";
import SwitchLayout from "@components/utility/SwitchLayout";
import ListLayout from "@components/layout/Files/ListLayout";
import LoadingFeedback from "@components/APIFeedback/Loading";
import ErrorFeedback from "@components/APIFeedback/Error";
import { useRouter } from "next/router";
import axios from "axios";
import Password from "@components/layout/Password";
import { GetServerSidePropsContext } from "next";

type Props = {
  passwordParent?: string;
};
export default function Folder({ passwordParent }: Props) {
  const router = useRouter();
  const { id } = router.query;

  const [data, setData] = useState<FilesResponse>();
  const [dataLoading, setDataLoading] = useState<boolean>(true);
  const [isReadmeExists, setIsReadmeExists] = useState<boolean>(false);
  const [renderStyle] = useLocalStorage<"grid" | "list">("renderStyle", "grid");
  const [layoutStyle, setLayoutStyle] = useState<"grid" | "list">(renderStyle);

  const [passwordStorage] = useLocalStorage<{
    [key: string]: string;
  }>("passwordStorage", {});

  const getNextKey = buildNextKey(`/api/files/${id}`);
  const {
    data: swrData,
    error,
    isLoading,
    size,
    setSize,
  } = useSWRInfinite<FilesResponse, ErrorResponse>(getNextKey, (url, headers) =>
    axios
      .get<FilesResponse>(url, {
        headers: {
          Authorization: `Bearer ${
            passwordStorage?.[passwordParent as string] ||
            passwordStorage?.[id as string] ||
            ""
          }`,
          ...headers,
        },
      })
      .then((res) => res.data),
  );
  const {
    data: readmeData,
    error: readmeError,
    isLoading: readmeLoading,
  } = useSWR(`/api/readme/${id}`, fetcher);

  const isLoadingInitialData = !swrData && !error;
  const isLoadingMore =
    isLoadingInitialData ||
    (size > 0 && swrData && typeof swrData[size - 1] === "undefined");
  const isEmpty =
    swrData?.[0]?.files?.length === 0 && swrData?.[0]?.folders?.length === 0;
  const isReachingEnd =
    isEmpty ||
    (swrData &&
      typeof swrData[swrData.length - 1]?.nextPageToken === "undefined");

  useEffect(() => {
    setDataLoading(true);
    const files: (TFile | drive_v3.Schema$File)[] | undefined =
      swrData?.flatMap((item: FilesResponse) => item.files);
    const folders: (TFile | drive_v3.Schema$File)[] | undefined =
      swrData?.flatMap((item: FilesResponse) => item.folders);
    const newData: FilesResponse = {
      ...(swrData?.[size - 1] as FilesResponse),
      files: files || [],
      folders: folders || [],
    };
    setData(newData);
    setDataLoading(false);
    if (newData.readmeExists) setIsReadmeExists(true);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [swrData, error, isLoading, size]);

  return (
    <div className='mx-auto flex max-w-screen-xl flex-col gap-4'>
      <div className='flex items-center justify-between'>
        <Breadcrumb
          data={data?.parents || []}
          isLoading={dataLoading}
        />
        <SwitchLayout setLayoutStyle={setLayoutStyle} />
      </div>

      {isLoading && <LoadingFeedback message={"Loading file..."} />}
      {!isLoading && error && <ErrorFeedback message={error.errors?.message} />}
      {!isLoading && !error && data && (
        <>
          {data.passwordRequired && !data.passwordValidated && (
            <Password folderId={id as string} />
          )}
          {(data.passwordValidated || !data.passwordRequired) && (
            <>
              {isReadmeExists && config.readme.position === "start" && (
                <div className='card w-full'>
                  {readmeLoading && (
                    <LoadingFeedback message={"Loading readme..."} />
                  )}
                  {readmeError && !readmeLoading && (
                    <ErrorFeedback message={readmeError.errors?.message} />
                  )}
                  {readmeData && !readmeLoading && (
                    <MarkdownRender content={readmeData as string} />
                  )}
                </div>
              )}

              <div className={"card"}>
                {layoutStyle === "list" && (
                  <ListLayout
                    data={data}
                    pagination={{
                      swrData,
                      isLoadingMore,
                      isReachingEnd,
                      size,
                      setSize,
                    }}
                  />
                )}
                {layoutStyle === "grid" && (
                  <GridLayout
                    data={data}
                    pagination={{
                      swrData,
                      isLoadingMore,
                      isReachingEnd,
                      size,
                      setSize,
                    }}
                  />
                )}
              </div>

              {isReadmeExists && config.readme.position === "end" && (
                <div className='card w-full'>
                  {readmeLoading && (
                    <LoadingFeedback message={"Loading readme..."} />
                  )}
                  {readmeError && !readmeLoading && (
                    <ErrorFeedback message={readmeError.errors?.message} />
                  )}
                  {readmeData && !readmeLoading && (
                    <MarkdownRender content={readmeData as string} />
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

export async function getServerSideProps(context: GetServerSidePropsContext) {
  const { id } = context.query;
  const passwordParent = await axios.get(
    `http://localhost:5000/api/files/${id}`,
  );

  if (passwordParent) {
    return {
      props: {
        passwordParent: passwordParent.data.protectedId || null,
      },
    };
  } else {
    return {
      props: {
        passwordParent: "",
      },
    };
  }
}
