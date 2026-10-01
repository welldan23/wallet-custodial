import { BottomSheet } from '@/components/ui/bottom-sheet';
import { useI18n } from '@/i18n';

import { NetworkOptionList } from './network-option-list';
import type { NetworkPickerProps } from './types';

type NetworkPickerSheetProps = NetworkPickerProps & {
  visible: boolean;
  onClose: () => void;
  title?: string;
};

/** Lembar bawah "Pilih Jaringan". Memilih jaringan langsung menutup lembar. */
export function NetworkPickerSheet({
  visible,
  onClose,
  title,
  onSelect,
  ...listProps
}: NetworkPickerSheetProps) {
  const { t } = useI18n();

  return (
    <BottomSheet visible={visible} onClose={onClose} title={title ?? t.networkPicker.title}>
      <NetworkOptionList
        {...listProps}
        onSelect={(networkId) => {
          onSelect(networkId);
          onClose();
        }}
      />
    </BottomSheet>
  );
}
