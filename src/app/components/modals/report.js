import { Anchor, Button, Divider, Modal, Select, Space, Text, TextInput } from "@mantine/core";
import { useForm } from "@mantine/form";
import { useTranslations } from "next-intl";

export default function ReportModal({ reportOpened, reportClose }) {
    const t = useTranslations('Home');
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

    return (
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
    )
}