import { AppLayout } from '@/components/layouts/AppLayout'
import { Button } from '@/ui/Button'
import Image from 'next/image'
import { Form } from '@/ui/forms/Form'
import { useZodForm } from '@/lib/hooks/useZodForm'
import { Input } from '@/ui/forms/Input'
import { Select, SelectOption } from '@/ui/forms/Select'
import { Badge } from '@/ui/Badge'
import { TransferHeader } from '@/components/TransferHeader'
import { TogglePayment } from '@/ui/TogglePayment'
import { GetServerSideProps, InferGetServerSidePropsType } from 'next'
import { accountService } from '@/lib/api/account'
import { paySchema, transfersService } from '@/lib/api/transfers'
import { useDialog } from '@/lib/hooks/useDialog'
import { SuccessDialog } from '@/components/dialogs/SuccessDialog'
import { getObjectKeys } from '@/utils/helpers'
import { useState } from 'react'
import { paymentPointerService } from '@/lib/api/paymentPointer'
import { ErrorDialog } from '@/components/dialogs/ErrorDialog'

type PayProps = InferGetServerSidePropsType<typeof getServerSideProps>

export default function Pay({ accounts }: PayProps) {
  const [openDialog, closeDialog] = useDialog()
  const [paymentPointers, setPaymentPointers] = useState<SelectOption[]>([])
  const [balance, setBalance] = useState('')
  const payForm = useZodForm({
    schema: paySchema
  })

  const handleAccountOnChange = async () => {
    const accountId = payForm.getValues('accountId')
    const selectedAccount = accounts.find(
      (account) => account.value === accountId
    )
    setBalance(
      selectedAccount
        ? `${selectedAccount.balance} ${selectedAccount.assetCode}`
        : ''
    )
    const paymentPointerResponse = await paymentPointerService.list(
      payForm.getValues('accountId')
    )

    if (!paymentPointerResponse.success || !paymentPointerResponse.data) {
      setPaymentPointers([])
      openDialog(
        <ErrorDialog
          onClose={closeDialog}
          content="Could not load payment pointers. Please try again"
        />
      )
      return
    }

    const paymentPointers = paymentPointerResponse.data.map(
      (paymentPointer) => ({
        name: `${paymentPointer.publicName} (${paymentPointer.url})`,
        value: paymentPointer.id
      })
    )

    setPaymentPointers(paymentPointers)
  }

  return (
    <AppLayout>
      <div className="flex flex-col lg:w-2/3">
        <TransferHeader type="pink" balance={balance} />
        <Form
          form={payForm}
          onSubmit={async (data) => {
            const response = await transfersService.pay(data)

            if (response.success) {
              openDialog(
                <SuccessDialog
                  onClose={closeDialog}
                  title="Funds payed."
                  content="Funds were successfully payed."
                  redirect={`/`}
                  redirectText="Go to your accounts"
                />
              )
            } else {
              const { errors, message } = response
              payForm.setError('root', { message })

              if (errors) {
                getObjectKeys(errors).map((field) =>
                  payForm.setError(field, { message: errors[field] })
                )
              }
            }
          }}
        >
          <div className="space-y-1">
            <Badge size="fixed" text="from" />
            <Select
              name="accountId"
              setValue={payForm.setValue}
              error={payForm.formState.errors.accountId?.message}
              options={accounts}
              onChange={handleAccountOnChange}
              label="Account"
            />
            <Select
              name="paymentPointerId"
              setValue={payForm.setValue}
              error={payForm.formState.errors.paymentPointerId?.message}
              options={paymentPointers}
              label="Payment Pointer"
            />
          </div>
          <div className="space-y-1">
            <Badge size="fixed" text="to" />
            <Input
              required
              {...payForm.register('incomingPaymentUrl')}
              error={payForm.formState.errors.incomingPaymentUrl?.message}
              label="Incoming payment URL"
            />
          </div>
          <div className="space-y-1">
            <TogglePayment disabled={true} type="pink" />
            <Input
              required
              {...payForm.register('amount')}
              error={payForm.formState.errors.amount?.message}
              label="Amount"
            />
          </div>
          <div className="flex justify-center py-5">
            <Button
              aria-label="Pay"
              type="submit"
              className="w-24"
              loading={payForm.formState.isSubmitting}
            >
              Pay
            </Button>
          </div>
        </Form>
      </div>
      <Image
        className="mt-10 hidden object-cover md:block"
        src="/pay.webp"
        alt="Pay"
        quality={100}
        width={600}
        height={200}
      />
      <Image
        className="my-auto object-cover md:hidden"
        src="/pay-mobile.webp"
        alt="Pay"
        quality={100}
        width={500}
        height={200}
      />
    </AppLayout>
  )
}

type SelectAccountOption = SelectOption & { balance: string; assetCode: string }
export const getServerSideProps: GetServerSideProps<{
  accounts: SelectAccountOption[]
}> = async (ctx) => {
  const [accountsResponse] = await Promise.all([
    accountService.list(ctx.req.headers.cookie)
  ])

  if (!accountsResponse.success) {
    return {
      notFound: true
    }
  }

  if (!accountsResponse.data) {
    return {
      notFound: true
    }
  }

  const accounts = accountsResponse.data.map((account) => ({
    name: `${account.name} (${account.assetCode})`,
    value: account.id,
    balance: account.balance,
    assetCode: account.assetCode
  }))

  return {
    props: {
      accounts
    }
  }
}