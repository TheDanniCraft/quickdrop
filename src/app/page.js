"use client"

import { ActionIcon, Anchor, Button, Center, Checkbox, Divider, Flex, Group, HoverCard, Image, List, Modal, Paper, rem, Space, Stack, Text, TextInput } from "@mantine/core";
import { Dropzone } from "@mantine/dropzone";
import { IconFile, IconShare, IconUpload, IconX } from "@tabler/icons-react";
import { useEffect, useState, useCallback } from "react";
import { useTranslations } from 'next-intl';
import { getFiles, saveFiles, purgeOldFolders } from "./action";
import { notifications } from "@mantine/notifications";
import { useSearchParams } from 'next/navigation';
import { useDisclosure } from "@mantine/hooks";
import { useQRCode } from 'next-qrcode';

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
  const [opened, { open, close }] = useDisclosure(false);
  const searchParams = useSearchParams();
  const { SVG } = useQRCode();

  const handleInputChange = useCallback(async (newCode) => {
    setKeyError(false);

    if (newCode.length === 6) {
      setLoading(true);
      const isValid = /^[A-Z0-9]{6}$/.test(newCode);
      if (isValid) {
        const files = await getFiles(newCode);

        if (!files) {
          setKeyError(t('noFilesFound'));
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
          title: t('success'),
          message: (
            <>
              {t('fileDownloadStart')}<br />
              {t('fileDownloadClick', { url: <Anchor href={url}>{t('here')}</Anchor> })}
            </>
          ),
          color: 'green',
        });
        setLoading(false);
      } else {
        setKeyError(t('invalidKey'));
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
        title: t('error'),
        message: t('uploadSizeExceeds'),
        color: 'red',
      });

      setPendingFiles(files);
      setUserPhrase('');
      setLoading(false);
      return;
    }

    setDownloadCode(await saveFiles(serializableFiles, keepLonger ? (7 * 24) : 2));
    open();
    setLoading(false);
    setFiles([]);
  }, [keepLonger, open]);

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
            title: t('notice'),
            message: t('bypassingFileSizeLimit'),
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
    const interval = setInterval(purgeOldFolders, 60000); // 60000 milliseconds = 1 minute
    purgeOldFolders();

    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <Center className="grow-y">
        <Paper shadow="xs" p="xl" radius="lg" withBorder style={{ borderColor: '#1a65a3' }} className="main">
          <Center>
            <Image
              h={150}
              w="auto"
              fit="contain"
              src="/QuickDropIconText.svg"
              onClick={() => window.location.href = window.location.origin}
              style={{ cursor: 'pointer' }}
            />
          </Center>
          <Space h="xs" />
          <TextInput
            label={t('enterDownloadKey')}
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

          <Divider label={t('or')} />

          <Checkbox
            label={t('preserveFiles')}
            description={t('preserveFilesDescription')}
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
                {t('dragFiles')}
              </Text>
            </Group>
          </Dropzone>
          <Space h="xs" />
          <Flex justify="space-between">
            <HoverCard>
              <HoverCard.Target>
                <Text>
                  {t('filesSelected', { count: files.length, size: files.length > 0 ? (files.reduce((acc, file) => acc + file.size, 0) / Math.pow(1000, Math.floor(Math.log2(files.reduce((acc, file) => acc + file.size, 0)) / 10))).toFixed(2) : 0, unit: files.length > 0 ? SIZE_UNITS[Math.floor(Math.log2(files.reduce((acc, file) => acc + file.size, 0)) / 10)] : 'B' })}
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

            <Button disabled={files.length === 0} color="#1a65a3" onClick={() => handleUpload(files)} leftSection={<IconUpload />}>{t('upload')}</Button>
          </Flex>
        </Paper>
      </Center>

      <Modal opened={opened} onClose={close} title={t('fileSaved')}>
        <Stack>
          <Center>
            <SVG
              text={`${window.location.origin}?code=${downloadCode}`}
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

          <Text>{t('fileSavedMessage')}</Text>
          <Center>
            <Text fw={1000}>{downloadCode}</Text>
            <Space w="xs" />
            <ActionIcon
              size="xs"
              onClick={() => {
                if (navigator.share) {
                  navigator.share({
                    title: t('shareTitle'),
                    text: t('shareText'),
                    url: `${window.location.origin}?code=${downloadCode}`,
                  }).catch((error) => {
                    console.error('Error sharing:', error);
                  });
                } else {
                  notifications.show({
                    title: t('error'),
                    message: t('shareNotSupported'),
                    color: 'red',
                  });
                }
              }}
              variant="transparent"
            >
              <IconShare />
            </ActionIcon>
          </Center>
          <Text size="xs">{t('fileExpires', { date: new Date(Date.now() + (keepLonger ? (7 * 24) : 2) * 60 * 60 * 1000).toLocaleString() })}</Text>
        </Stack>
      </Modal>
    </>
  );
}
