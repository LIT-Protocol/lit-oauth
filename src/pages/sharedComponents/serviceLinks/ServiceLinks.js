import { presetGpnDefault, Theme } from "@consta/uikit/Theme";
import { Card } from "@consta/uikit/Card";
import { Text } from "@consta/uikit/Text";
import { Table } from "@consta/uikit/__internal__/src/components/Table/Table";
import { Button } from "@consta/uikit/Button";
import { IconEdit } from '@consta/uikit/IconEdit';
import { IconAttach } from '@consta/uikit/IconAttach';
import { IconCopy } from '@consta/uikit/IconCopy';
import { IconTrash } from '@consta/uikit/IconTrash';

import './ServiceLinks.scss';

export default function ServiceLinks(props) {
  const listOfLinks = props.listOfLinks;
  const serviceName = props.serviceName;

  const cols = [
    {
      title: 'File Name',
      accessor: 'fileName',
      align: 'left',
      sortable: true
    },
    {
      title: 'Requirements',
      accessor: 'requirements',
      align: 'left',
      sortable: true
    },
    {
      title: 'File Type',
      accessor: 'fileType',
      align: 'left',
      sortable: true
    },
    {
      title: 'Permission',
      accessor: 'permission',
      align: 'left',
      sortable: true
    },
    {
      title: 'Date Created',
      accessor: 'dateCreated',
      align: 'left',
      sortable: true
    },
    {
      title: 'Actions',
      accessor: 'actions',
      align: 'left',
      sortable: true,
      renderCell: (row) => {
        return (
          <span className={'links-actions'}>
            <Button className={'links-actions-buttons'}
                    size={'m'}
                    iconLeft={IconEdit}
                    onlyIcon>
            </Button>
            <Button className={'links-actions-buttons'}
                    size={'m'}
                    iconLeft={IconAttach}
                    onlyIcon>
            </Button>
            <Button className={'links-actions-buttons'}
                    size={'m'}
                    iconLeft={IconCopy}
                    onlyIcon>
            </Button>
            <Button className={'links-actions-buttons'}
                    size={'m'}
                    iconLeft={IconTrash}
                    onlyIcon>
            </Button>
          </span>
        )
      }
    },
  ]

  if (listOfLinks && cols) {
    return (
      <Theme preset={presetGpnDefault}>
        <Card className={'links-card'} shadow={false}>
          <span class={'links-header'}>
            <Text className={'links-service-title'} size={'xl'}>{`Your ${serviceName} Items`}</Text>
            <Button label={'Provision Access'} view={'secondary'}></Button>
          </span>
          <Table columns={cols} rows={listOfLinks}></Table>
        </Card>
      </Theme>
    )
  } else {
    return (
      <Text label={'Loading Links'}></Text>
    )
  }
}
