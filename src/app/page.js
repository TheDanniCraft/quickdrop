"use client"

import { ActionIcon, Anchor, Button, Center, Checkbox, Divider, Flex, Group, HoverCard, Image, List, Modal, Paper, rem, Space, Stack, Text, TextInput } from "@mantine/core";
import { Dropzone } from "@mantine/dropzone";
import { IconFile, IconShare, IconUpload, IconX } from "@tabler/icons-react";
import { useEffect, useState, useCallback, useSyncExternalStore, useEffectEvent } from "react";
import { useTranslations } from 'next-intl';
import { getFiles, saveFiles, purgeOldFolders, updateMetric } from "./action";
import { notifications } from "@mantine/notifications";
import { useSearchParams } from 'next/navigation';
import { useDisclosure } from "@mantine/hooks";
import { MAX_FILE_SIZE, SECRET_PHRASE, SIZE_UNITS, EXTEND_DURATION, DEFAULT_DURATION } from "@/constants";
import { ReportModal, UploadConfirmModal } from "./components"

function subscribeToOrigin() {
  return () => {};
}

export default function Home() {
  const t = useTranslations('Home');
  const [requestError, setKeyError] = useState(false);
  const searchParams = useSearchParams();
  const queryCode = (searchParams.get('code') || '').toUpperCase();
  const [codeInput, setCodeInput] = useState(null);
  const code = codeInput?.query === queryCode ? codeInput.value : queryCode;
  const setCode = (value) => setCodeInput({ query: queryCode, value });
  const [files, setFiles] = useState([]);
  const [keepLonger, setKeepLonger] = useState(false);
  const [busy, setLoading] = useState(false);
  const [completedQuery, setCompletedQuery] = useState(null);
  const validQuery = /^[A-Z0-9]{6}$/.test(queryCode);
  const loading = busy || (validQuery && completedQuery !== queryCode);
  const keyError = requestError || (codeInput?.query !== queryCode && queryCode.length === 6 && !validQuery ? t('download.invalidKey') : false);
  const [downloadCode, setDownloadCode] = useState('');
  const [pendingFiles, setPendingFiles] = useState(null);
  const [userPhrase, setUserPhrase] = useState('');
  const [fileSavedOpened, { open: fileSavedOpen, close: fileSavedClose }] = useDisclosure(false);
  const [reportOpened, { open: reportOpen, close: reportClose }] = useDisclosure(false);
  const [expiresAt, setExpiresAt] = useState(null);
  const origin = useSyncExternalStore(
    subscribeToOrigin,
    () => window.location.origin,
    () => ''
  );

  const downloadFiles = useCallback(async (newCode) => {
    const files = await getFiles(newCode);
    setKeyError(false);
    if (!files) {
      setKeyError(t('download.noFilesFound'));
      setLoading(false);
      return;
    }

    const blob = new Blob([new Uint8Array(files)], { type: 'application/zip' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = `${newCode}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    notifications.show({
      title: t('download.success'),
      message: (
        <>
          {t('download.fileDownloadStart')}<br />
          {t('download.fileDownloadClick', { url: <Anchor href={url}>{t('general.here')}</Anchor> })}
        </>
      ),
      color: 'green',
    });
    setLoading(false);
  }, [t, setLoading]);

  const handleInputChange = useCallback(async (newCode) => {
    setKeyError(false);
    if (newCode.length !== 6) return;
    if (!/^[A-Z0-9]{6}$/.test(newCode)) {
      setKeyError(t('download.invalidKey'));
      return;
    }
    setLoading(true);
    await downloadFiles(newCode);
  }, [t, downloadFiles, setLoading]);

  const handleUpload = useCallback(async (files, skipSizeCheck = false) => {
    setLoading(true);
    const serializableFiles = await Promise.all(Array.from(files).map(async file => ({
      name: file.name,
      size: file.size,
      data: Array.from(new Uint8Array(await file.arrayBuffer())),
      type: file.type,
      lastModified: file.lastModified
    })));

    const totalSize = serializableFiles.reduce((acc, file) => acc + file.size, 0);

    if (!skipSizeCheck && totalSize > MAX_FILE_SIZE) {
      notifications.show({
        title: t('general.error'),
        message: t('upload.uploadSizeExceeds'),
        color: 'red',
      });

      setPendingFiles(files);
      setUserPhrase('');
      setLoading(false);
      return;
    }

    setDownloadCode(await saveFiles(serializableFiles, keepLonger ? (EXTEND_DURATION * 24) : DEFAULT_DURATION));
    setExpiresAt(Date.now() + (keepLonger ? EXTEND_DURATION * 24 : DEFAULT_DURATION) * 60 * 60 * 1000);
    fileSavedOpen();
    setLoading(false);
    setFiles([]);
  }, [keepLonger, fileSavedOpen, t, setLoading, setFiles]);

  const downloadFromQuery = useEffectEvent(async (value) => {
    if (!/^[A-Z0-9]{6}$/.test(value)) return;
    try { await downloadFiles(value); } finally { setCompletedQuery(value); }
  });
  useEffect(() => {
    if (queryCode) downloadFromQuery(queryCode);
  }, [queryCode]);

  useEffect(() => {
    const handleKeydown = async (event) => {
      if (pendingFiles) {
        const newPhrase = userPhrase + event.key.toLowerCase();
        setUserPhrase(newPhrase);
        console.log(newPhrase);
        if (newPhrase.includes(SECRET_PHRASE)) {
          notifications.show({
            title: t('general.notice'),
            message: t('upload.bypassingFileSizeLimit'),
            color: 'blue',
          });

          await handleUpload(pendingFiles, true);

          // Clear the pending files and reset the user phrase
          setPendingFiles(null);
          setUserPhrase('');
        }
      }
    };

    document.addEventListener('keydown', handleKeydown);
    return () => document.removeEventListener('keydown', handleKeydown);
  }, [pendingFiles, userPhrase, handleUpload, t]);

  useEffect(() => {
    const interval = setInterval(purgeOldFolders, 60000);
    purgeOldFolders();

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let browser = 'unknown';
    if (navigator.userAgentData?.brands) {
      browser = navigator.userAgentData.brands[0].brand;
    } else {
      // Fallback to userAgent parsing
      if (navigator.userAgent.includes("Chrome") && !navigator.userAgent.includes("Edg") && !navigator.userAgent.includes("OPR")) {
        browser = 'Chrome';
      } else if (navigator.userAgent.includes("Edg")) {
        browser = 'Edge';
      } else if (navigator.userAgent.includes("Firefox")) {
        browser = 'Firefox';
      } else if (navigator.userAgent.includes("Safari") && !navigator.userAgent.includes("Chrome")) {
        browser = 'Safari';
      } else if (navigator.userAgent.includes("OPR") || navigator.userAgent.includes("Opera")) {
        browser = 'Opera';
      } else if (navigator.userAgent.includes("MSIE") || !!document.documentMode) {
        browser = 'IE';
      }
    }
    const language = navigator.language || navigator.languages[0];

    const OS_MAPPING = {
      win: 'Windows',
      mac: 'macOS',
      linux: 'Linux',
      android: 'Android',
      iphone: 'iOS',
      ipad: 'iOS',
      ipod: 'iOS'
    };

    const os = navigator.userAgentData?.platform ||
      Object.entries(OS_MAPPING).find(([key]) =>
        navigator.platform.toLowerCase().includes(key) ||
        navigator.userAgent.toLowerCase().includes(key)
      )?.[1] || 'unknown';

    const metrics = [
      ['visitors', 1],
      [`visitors_browser_${browser}`, 1],
      [`visitors_language_${language}`, 1],
      [`visitors_os_${os}`, 1]
    ];

    Promise.all(metrics.map(([name, value]) =>
      updateMetric(name, value).catch(error =>
        console.error(`Failed to update metric ${name}:`, error)
      )
    ));
  }, []);

  return (
    <>
      <Center className="grow-y">
        <Stack>
          <Paper shadow="xs" p="xl" radius="lg" withBorder style={{ borderColor: '#1a65a3' }} className="main">
            <Center>
              <Image
                alt="QuickDrop"
                h={150}
                w="auto"
                fit="contain"
                src="/QuickDropIconText.svg"
                onClick={() => window.location.href = origin}
                style={{ cursor: 'pointer' }}
              />
            </Center>
            <Space h="xs" />
            <TextInput
              label={t('download.enterDownloadKey')}
              placeholder="K923HE"
              maxLength={6}
              required
              onChange={async (event) => {
                const newCode = event.target.value.toUpperCase();
                setCode(newCode);
                handleInputChange(newCode);
              }}
              onPaste={async (event) => {
                const pastedText = event.clipboardData.getData('Text').toUpperCase();
                setCode(pastedText);
                handleInputChange(pastedText);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  handleInputChange(code);
                }
              }}
              value={code}
              error={keyError}
              disabled={loading}
            />

            <Divider label={t('general.or')} />

            <Checkbox
              label={t('general.preserveFiles', { extendDuration: EXTEND_DURATION })}
              description={t('general.preserveFilesDescription', { defaultDuration: DEFAULT_DURATION })}
              checked={keepLonger}
              onChange={(event) => setKeepLonger(event.currentTarget.checked)}
            />
            <Space h="xs" />
            <Dropzone
              onDrop={(droppedFiles) => {
                const newFiles = Array.from(droppedFiles).map(file => {
                  let fileName = file.name;
                  let counter = 1;
                  while (files.some(f => f.name === fileName)) {
                    const nameParts = file.name.split('.');
                    const extension = nameParts.pop();
                    fileName = `${nameParts.join('.')}_${counter}.${extension}`;
                    counter++;
                  }
                  return new File([file], fileName, { type: file.type, lastModified: file.lastModified });
                });
                setFiles(prevFiles => [...prevFiles, ...newFiles]);
              }}
              loading={loading}
            >
              <Group justify="center" gap="xl" mih={220} style={{ pointerEvents: 'none' }}>
                <Dropzone.Accept>
                  <IconUpload
                    style={{ width: rem(52), height: rem(52), color: 'var(--mantine-color-blue-6)' }}
                    stroke={1.5}
                  />
                </Dropzone.Accept>
                <Dropzone.Reject>
                  <IconX
                    style={{ width: rem(52), height: rem(52), color: 'var(--mantine-color-red-6)' }}
                    stroke={1.5}
                  />
                </Dropzone.Reject>
                <Dropzone.Idle>
                  <IconFile
                    style={{ width: rem(52), height: rem(52), color: 'var(--mantine-color-dimmed)' }}
                    stroke={1.5}
                  />
                </Dropzone.Idle>

                <Text inline>
                  {t('upload.dragFiles')}
                </Text>
              </Group>
            </Dropzone>
            <Space h="xs" />
            <Flex justify="space-between">
              <HoverCard>
                <HoverCard.Target>
                  <Text>
                    {t('upload.filesSelected', { count: files.length, size: files.length > 0 ? (files.reduce((acc, file) => acc + file.size, 0) / Math.pow(1000, Math.floor(Math.log2(files.reduce((acc, file) => acc + file.size, 0)) / 10))).toFixed(2) : 0, unit: files.length > 0 ? SIZE_UNITS[Math.floor(Math.log2(files.reduce((acc, file) => acc + file.size, 0)) / 10)] : 'B' })}
                  </Text>
                </HoverCard.Target>
                {files.length > 0 && (
                  <HoverCard.Dropdown>
                    <List style={{ maxHeight: '190px', overflowY: 'auto' }}>
                      {files.map((file, index) => (
                        <List.Item key={index}>
                          <Flex justify="space-between" align="center">
                            <ActionIcon
                              size="xs"
                              color="red"
                              variant="transparent"
                              onClick={() => setFiles(files.filter((_, i) => i !== index))}
                            >
                              <IconX size={12} />
                            </ActionIcon>
                            <Text>{file.name}</Text>
                          </Flex>
                        </List.Item>
                      ))}
                    </List>
                  </HoverCard.Dropdown>
                )}
              </HoverCard>

              <Button disabled={files.length === 0} color="#1a65a3" onClick={() => handleUpload(files)} leftSection={<IconUpload />}>{t('upload.upload')}</Button>
            </Flex>
          </Paper>
          <Button variant="transparent" c="red" onClick={reportOpen}>{t('report.reportContent')}</Button>
        </Stack>
      </Center>

      <UploadConfirmModal fileSavedOpened={fileSavedOpened} fileSavedClose={fileSavedClose} expiresAt={expiresAt} origin={origin} downloadCode={downloadCode} />

      <ReportModal reportOpened={reportOpened} reportClose={reportClose} />
    </>
  );
}
