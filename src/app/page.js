"use client"

import { Anchor, Center, Checkbox, Divider, Group, Modal, Paper, rem, Space, Stack, Text, TextInput } from "@mantine/core";
import { Dropzone } from "@mantine/dropzone";
import { IconCircleCheck, IconCircleCheckFilled, IconFile, IconUpload, IconX } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { getFiles, saveFiles, purgeOldFolders } from "./action";
import { notifications } from "@mantine/notifications";
import { useSearchParams } from 'next/navigation';
import { useDisclosure } from "@mantine/hooks";
import { useQRCode } from 'next-qrcode';

export default function Home() {
  const [keyError, setKeyError] = useState(false);
  const [code, setCode] = useState('');
  const [keepLonger, setKeepLonger] = useState(false);
  const [loading, setLoading] = useState(false);
  const [downloadcCode, setDownloadCode] = useState('');
  const [opened, { open, close }] = useDisclosure(false);
  const searchParams = useSearchParams();
  const { SVG } = useQRCode();

  useEffect(() => {
    const codeParam = searchParams.get('code');
    if (codeParam) {
      setCode(codeParam.toUpperCase());
      handleInputChange(codeParam.toUpperCase());
    }
  }, [searchParams]);
  let pendingFiles = null;
  const SECRET_PHRASE = "confirm";
  let userPhrase = '';

  document.addEventListener('keydown', async function handleKeydown(event) {
    if (pendingFiles) userPhrase += event.key.toLowerCase();
    if (userPhrase.includes(SECRET_PHRASE) && pendingFiles) {
      notifications.show({
        title: 'Notice',
        message: 'Bypassing file size limit!',
        color: 'blue',
      });

      handleDrop(pendingFiles, true)

      // Clear the pending files and reset the user phrase
      pendingFiles = null;
      userPhrase = '';
    }
  });

  useEffect(() => {
    const interval = setInterval(() => {
      purgeOldFolders();
    }, 60000); // 60000 milliseconds = 1 minute

    purgeOldFolders();

    return () => clearInterval(interval);
  }, []);

  async function handleInputChange(newCode) {
    setKeyError(false);

    if (newCode.length === 6) {
      setLoading(true);
      const isValid = /^[A-Z0-9]{6}$/.test(newCode);
      if (isValid) {
        const files = await getFiles(newCode);

        if (!files) {
          setKeyError('No files found')
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
          title: 'Success',
          message: (
            <>
              File download should start soon...<br />
              If the download doesn&apos;t start click <Anchor href={url}>here</Anchor>
            </>
          ),
          color: 'green',
        });
        setLoading(false);
      } else {
        setKeyError('Invalid key');
        setLoading(false);
      }
    }
  };

  async function handleDrop(files, skipSizeCheck) {
    setLoading(true);
    const serializableFiles = await Promise.all(Array.from(files).map(async file => ({
      name: file.name,
      size: file.size,
      data: Array.from(new Uint8Array(await file.arrayBuffer())),
      type: file.type,
      lastModified: file.lastModified
    })));

    const totalSize = serializableFiles.reduce((acc, file) => acc + file.size, 0);
    const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB limit

    if (!skipSizeCheck) {
      if (totalSize > MAX_FILE_SIZE) {
        notifications.show({
          title: 'Error',
          message: 'Upload size exceeds the limit. Please contact a team member.',
          color: 'red',
        });

        pendingFiles = files;
        userPhrase = '';
        setLoading(false);
        return;
      }
    }

    setDownloadCode(await saveFiles(serializableFiles, keepLonger ? (7 * 24) : 2));
    open()
    setLoading(false);
  }

  return (
    <>
      <Center className="grow-y">
        <Paper shadow="xs" p="xl">
          <TextInput
            label="Enter a download key"
            placeholder="K923HE"
            maxLength={6}
            required
            onChange={async (event) => {
              await setCode(event.target.value.toUpperCase());
              handleInputChange(event.target.value.toUpperCase())
            }}
            onPaste={async (event) => {
              const pastedText = event.clipboardData.getData('Text').toUpperCase();
              await setCode(pastedText);
              handleInputChange(pastedText);
            }}
            value={code}
            error={keyError}
            disabled={loading}
          />

          <Divider label="or" />

          <Checkbox
            label="Preserve files for 7 days"
            description="By default files are kept for 2 hours"
            checked={keepLonger}
            onChange={(event) => setKeepLonger(event.currentTarget.checked)}
          />
          <Space h="xs" />
          <Dropzone
            onDrop={(files) => handleDrop(files, false)}
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

              <Text size="xl" inline>
                Drag files here or click to select files
              </Text>
            </Group>
          </Dropzone>

        </Paper>
      </Center>

      <Modal opened={opened} onClose={close} title="File saved!">
        <Stack>
          <Center>
            <SVG
              text={`${window.location.origin}?code=${downloadcCode}`}
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

          <Text>Your file was successfully saved. Use the following code to download it:</Text>
          <Center>
            <Text fw={1000}>{downloadcCode}</Text>
          </Center>
          <Text size="xs">Your file expires on {new Date(Date.now() + (keepLonger ? (7 * 24) : 2) * 60 * 60 * 1000).toLocaleString()}</Text>
        </Stack>
      </Modal>
    </>
  );
}
