"use client"

import { ActionIcon, Anchor, Button, Center, Checkbox, Divider, Flex, Group, HoverCard, Image, List, Modal, Paper, rem, Select, Space, Stack, Text, TextInput } from "@mantine/core";
import { Dropzone } from "@mantine/dropzone";
import { IconAlertTriangle, IconAlertTriangleFilled, IconFile, IconShare, IconUpload, IconX } from "@tabler/icons-react";
import { useEffect, useState, useCallback } from "react";
import { useTranslations } from 'next-intl';
import { getFiles, saveFiles, purgeOldFolders, updateMetric } from "./action";
import { notifications } from "@mantine/notifications";
import { useSearchParams } from 'next/navigation';
import { useDisclosure } from "@mantine/hooks";
import { useQRCode } from 'next-qrcode';
import { useForm } from "@mantine/form";

const SECRET_PHRASE = "confirm";
const MAX_FILE_SIZE = 25 * 1000 * 1000; // 25MB limit
const SIZE_UNITS = ['B', 'KB', 'MB', 'GB'];

export default function Home() {
  const t = useTranslations('Home');
  const [keyError, setKeyError] = useState(false);
  const [code, setCode] = useState('');
  const [files, setFiles] = useState([]);
  const [keepLonger, setKeepLonger] = useState(false);
  const [loading, setLoading] = useState(false);
  const [downloadCode, setDownloadCode] = useState('');
  const [pendingFiles, setPendingFiles] = useState(null);
  const [userPhrase, setUserPhrase] = useState('');
  const [fileSavedOpened, { open: fileSavedOpen, close: fileSavedClose }] = useDisclosure(false);
  const [reportOpened, { open: reportOpen, close: reportClose }] = useDisclosure(false);
  const [origin, setOrigin] = useState('');
  const searchParams = useSearchParams();
  const { SVG } = useQRCode();
  const reportForm = useForm({
    initialValues: {
      code: '',
      reason: '',
      aditional: ''
    },
    validate: {
      code: (value) => /^[A-Z0-9]{6}$/.test(value) ? null : t('report.invalidCode'),
      reason: (value) => value ? null : t('report.reasonRequired'),
      aditional: (value, values) => values.reason === t('report.reasons.other') && !value ? t('report.additionalRequired') : null
    }
  });
  const DEFAULT_DURATION = 2; // hours
  const EXTEND_DURATION = 7; // days

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const handleInputChange = useCallback(async (newCode) => {
    setKeyError(false);

    if (newCode.length === 6) {
      setLoading(true);
      const isValid = /^[A-Z0-9]{6}$/.test(newCode);
      if (isValid) {
        const files = await getFiles(newCode);

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
      } else {
        setKeyError(t('download.invalidKey'));
        setLoading(false);
      }
    }
  }, [t]);

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
    fileSavedOpen();
    setLoading(false);
    setFiles([]);
  }, [keepLonger, fileSavedOpen]);

  useEffect(() => {
    const codeParam = searchParams.get('code');
    if (codeParam) {
      setCode(codeParam.toUpperCase());
      handleInputChange(codeParam.toUpperCase());
    }
  }, [searchParams, handleInputChange]);

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
  }, [pendingFiles, userPhrase, handleUpload]);

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

      <Modal opened={fileSavedOpened} onClose={fileSavedClose} title={t('upload.fileSaved')}>
        <Stack>
          <Center>
            <SVG
              text={`${origin}?code=${downloadCode}`}
              options={{
                level: 'M',
                margin: 3,
                scale: 4,
                width: 200,
                color: {
                  dark: '#C9C9C9',
                  light: '#FFFFFF00',
                },
              }}
            />
          </Center>

          <Text>{t('upload.fileSavedMessage')}</Text>
          <Center>
            <Text fw={1000}>{downloadCode}</Text>
            <Space w="xs" />
            <ActionIcon
              size="xs"
              onClick={() => {
                if (navigator.share) {
                  navigator.share({
                    title: t('share.shareTitle'),
                    text: t('share.shareText'),
                    url: `${origin}?code=${downloadCode}`,
                  }).catch((error) => {
                    console.error('Error sharing:', error);
                  });
                } else {
                  notifications.show({
                    title: t('general.error'),
                    message: t('share.shareNotSupported'),
                    color: 'red',
                  });
                }
              }}
              variant="transparent"
            >
              <IconShare />
            </ActionIcon>
          </Center>
          <Text size="xs">{t('download.fileExpires', { date: new Date(Date.now() + (keepLonger ? (EXTEND_DURATION * 24) : DEFAULT_DURATION) * 60 * 60 * 1000).toLocaleString() })}</Text>
        </Stack>
      </Modal>

      <Modal opened={reportOpened} onClose={reportClose} title={t('report.reportContent')}>
        <Text>{t.rich('report.reportRawText', { mail: <Anchor key="report-mail" href={`mailto:${process.env.NEXT_PUBLIC_REPORT_MAIL}`}>{process.env.NEXT_PUBLIC_REPORT_MAIL}</Anchor> })}</Text>
        <Divider my="md" />
        <form onSubmit={reportForm.onSubmit((values) => {
          const reason = values.reason === t('report.reasons.other') ? values.aditional : values.reason;
          window.location.href = `mailto:${process.env.NEXT_PUBLIC_REPORT_MAIL}?subject=${t('report.mailTemplate.subject', { code: values.code })}&body=${t('report.mailTemplate.body', { code: values.code, reason })}`;
        })}>
          <TextInput
            withAsterisk
            maxLength={6}
            label={t('report.code')}
            placeholder="K923HE"
            key={reportForm.key('code')}
            {...reportForm.getInputProps('code')}
            onChange={(event) => {
              reportForm.setFieldValue('code', event.target.value.toUpperCase());
            }}
          />
          <Space h="xs" />
          <Select
            label={t('report.reason')}
            placeholder={t('report.reasonPlaceholder')}
            withAsterisk
            data={
              [
                t('report.reasons.copyrightInfringement'),
                t('report.reasons.malwareOrVirus'),
                t('report.reasons.illegalContent'),
                t('report.reasons.harassmentOrAbuse'),
                t('report.reasons.sensitiveOrPersonalInformation'),
                t('report.reasons.violentOrGraphicContent'),
                t('report.reasons.spamOrMisleadingContent'),
                t('report.reasons.hateSpeechOrDiscrimination'),
                t('report.reasons.inappropriateOrOffensiveContent'),
                t('report.reasons.dislikeContent'),
                t('report.reasons.other')
              ]
            }
            key={reportForm.key('reason')}
            {...reportForm.getInputProps('reason')}
          />
          <Space h="xs" />
          <TextInput
            placeholder={t('report.other')}
            hidden={reportForm.values.reason == t('report.reasons.other') ? false : true}
            withAsterisk
            key={reportForm.key('aditional')}
            {...reportForm.getInputProps('aditional')}
          />
          <Space h="xs" />
          <Button color="red" type="submit" disabled={!reportForm.isValid()}>Send report</Button>
        </form>
      </Modal>
    </>
  );
}
