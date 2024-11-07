import { ActionIcon, Center, Modal, Space, Stack, Text } from "@mantine/core";
import { IconShare } from "@tabler/icons-react";
import { useTranslations } from "next-intl";
import { useQRCode } from "next-qrcode";
import { DEFAULT_DURATION, EXTEND_DURATION } from "@/constants";

export default function UploadConfirmModal({ fileSavedOpened, fileSavedClose, origin, keepLonger, downloadCode }) {
    const t = useTranslations('Home');
    const { SVG } = useQRCode();

    return (
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
    )
}